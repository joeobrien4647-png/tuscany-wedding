// The home screen: the one calm screen a guest lives on after saying yes. A big countdown to the wedding, a small one to
// the next envelope, the six envelopes (all sealed in phase 1) and the dock of four, with Questions, the sound toggle
// and a way to watch the invitation again. Ported from the first-minute prototype; every word is set with textContent.
// show({ root, ctx }) draws it and ticks once a second; refresh() reads the household again (also when the page is
// visible again) and leaves for the can't-come screen if the answer is now no. Cards open through cards.open when it exists;
// repaint() paints the dock again after a card has saved, without a read. show({ open: key }) opens that card once home
// has landed (the Reply card, offering the food step after a saved yes).
(function (root) {
  'use strict';
  const TOAST_MS = 2300, COUNT_UP_MS = 1300, OPEN_AFTER_MS = 500;
  const DOCK_KEYS = ['reply', 'stay', 'travel', 'weekend'];
  const DOCK_ICONS = ['reply', 'stay', 'drive', 'weekend'];

  // core.js loads first on the page; under Node tests it is required here.
  const core = root.sjFirst && root.sjFirst.LOCKS ? root.sjFirst
    : typeof require === 'function' ? require('./core.js') : {};

  const pad = n => String(n).padStart(2, '0');
  const clockText = (c, u) => c.hours + ' ' + u.h + ' ' + pad(c.minutes) + ' ' + u.m + ' ' + pad(c.seconds) + ' ' + u.s;

  // The six envelopes as the screen shows them. In phase 1 none has content, so every one is sealed.
  function envelopes(nowMs, w) {
    return core.LOCKS.map(lock => {
      const name = w.home.envelopes[lock.key].name, what = w.home.envelopes[lock.key].what;
      const stamp = lock.opensMs === null ? w.home.photosStamp : core.ukDate(lock.opensMs);
      // Past its date with nothing inside yet: it is nearly ready, never "opens" on a date gone by.
      const due = lock.opensMs !== null && nowMs >= lock.opensMs;
      return {
        key: lock.key, name, stamp,
        state: core.lockState(lock, nowMs, false),
        label: name + ', ' + (due ? w.home.soon : core.fill(w.home.sealed, { date: stamp })),
        // What it holds, when there are words for it, then when it opens (the note is announced as it shows).
        toast: what ? core.fill(w.home.inside, { what, when: due ? w.home.soon : core.fill(w.home.opens, { date: stamp }) })
          : due ? w.home.soon : core.fill(w.home.opens, { date: stamp })
      };
    });
  }

  // The four dock items: plain, glowing (something to do) or done. Only the reply and the stay choice change them.
  function dockItems(household, w, travelStamped) {
    const states = core.dockStates(household, travelStamped);
    return DOCK_KEYS.map((key, i) => {
      const label = key === 'stay' ? core.stayLabel(household, w.dock.stay) : w.dock.labels[i];
      const state = states[key];
      return { key, label, state, aria: label + ', ' + w.dock.states[state] };
    });
  }

  // Whether this phone holds a stamped Getting there ticket for this invitation.
  function travelStamped(ctx) {
    const store = (root.sjFirst || {}).store, token = ctx && ctx.invite && ctx.invite.token;
    return !!(store && store.travelCopy && token) && store.travelCopy.read(token).tickets.some(Boolean);
  }

  function bigCount(nowMs, w) {
    const c = core.countdown(core.WEDDING_MS, nowMs);
    return { days: c.days, label: c.days === 1 ? w.home.countdownOne : w.home.countdown, clock: clockText(c, w.home.units) };
  }

  // The next envelope by name and how long until it opens, or null after the last dated one.
  // Remind me: a calendar file of the weekend and the envelopes' opening days, or, on Android, where Google Calendar
  // cannot read such a file, Google Calendar's own form for the next envelope's day. No envelope left: no link.
  const SITE = 'https://sophieandjoe2027.com', DATES_FILE = 'tuscany-2027-dates.ics';
  const UK_DAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });
  function calendarDay(ms) {
    const parts = UK_DAY.formatToParts(new Date(ms)), part = t => parts.find(p => p.type === t).value;
    return part('year') + part('month') + part('day');
  }
  function remindHref(nowMs, ua, w) {
    const lock = core.nextLock(nowMs);
    if (!lock) return null;
    if (!/Android/i.test(ua || '')) return DATES_FILE;
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' +
      encodeURIComponent(core.fill(w.home.remindEvent, { name: w.home.envelopes[lock.key].name })) +
      '&dates=' + calendarDay(lock.opensMs) + '/' + calendarDay(lock.opensMs + 86400000) + '&details=' + encodeURIComponent(SITE);
  }

  function nextLine(nowMs, w) {
    const lock = core.nextLock(nowMs);
    if (!lock) return null;
    const c = core.countdown(lock.opensMs, nowMs);
    const when = c.days >= 2 ? core.fill(w.home.nextIn, { n: c.days })
      : c.days === 1 ? w.home.nextDay : core.fill(w.home.nextSoon, { n: clockText(c, w.home.units) });
    return w.home.envelopes[lock.key].name + ' ' + when;
  }

  // What a fresh read of the household does: no clear answer keeps the screen, a no leaves for can't come, and no
  // reply at all (cleared or deleted) goes back to the question while replies are open, to the closed screen after.
  function afterRefresh(household, nowMs) {
    if (household === undefined || (household !== null && typeof household !== 'object')) return 'keep';
    const reply = household && household.reply;
    if (!reply) return core.repliesOpen(nowMs) ? 'ask' : 'closed';
    return reply.answer === 'no' ? 'cantcome' : 'render';
  }

  // Whether a fresh read brings a different stay choice (a partner chose on their own phone).
  const choiceOf = h => (h && h.stay && h.stay.choice) || null;
  const stayChanged = (before, after) => choiceOf(before) !== choiceOf(after);

  const svg = (inner, size) => '<svg width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + inner + '</svg>';
  const ICON = {
    reply: svg('<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M4 7l8 6 8-6"/>'),
    stay: svg('<path d="M4 11l8-6 8 6v9H4z"/><path d="M10 20v-5h4v5"/>'),
    drive: svg('<path d="M12 21s-6-5.4-6-10.6a6 6 0 0 1 12 0C18 15.6 12 21 12 21z"/><circle cx="12" cy="10.4" r="2.2"/>'),
    weekend: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
    lock: svg('<rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 16),
    soundOn: svg('<path d="M4 9.5h3.6L12.5 5.5v13l-4.9-4H4z"/><path d="M16 9a4.2 4.2 0 0 1 0 6M18.6 6.4a7.8 7.8 0 0 1 0 11.2"/>'),
    soundOff: svg('<path d="M4 9.5h3.6L12.5 5.5v13l-4.9-4H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>')
  };
  // The envelope's flap and its wax seal (the minute's seal art, drawn small).
  const FLAP = '<svg class="fh-flap" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 0 L50 46 L100 0" fill="rgba(245, 236, 220, .04)" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>';
  const WAX = '<svg class="fh-wax" viewBox="-20 -20 240 240" aria-hidden="true" focusable="false"><use href="#fm-seal-art"/></svg>';
  // An envelope with an emblem of what it holds: the seal's wax without the S&J, the emblem pressed in and brushed
  // with gold so it reads at a glance. Each path sits in its own 2048 box; at moves it into the seal's well.
  const EMBLEMS = {
    estate: { at: 'translate(100 100) scale(.0696) translate(-1024 -1024)', d: 'M 1387.4 912.2 C 1399.3 911.3 1406.1 912.3 1413.6 921.8 C 1429.7 922.5 1445.8 923.1 1461.9 923.4 L 1462.5 936.9 C 1478.5 936.8 1494.5 936.8 1510.5 936.9 C 1506.8 944.7 1501.9 953.4 1497.9 961.1 L 1474.8 961.1 L 1474.4 1116.8 C 1485.1 1117.9 1514.8 1119.5 1523.1 1121.7 C 1525.4 1124 1524.6 1124 1524.9 1128.3 C 1529.3 1134.4 1580.4 1131.5 1586.8 1137.1 L 1586.9 1141.9 C 1591.1 1148.6 1642.6 1145.7 1648.9 1151.6 C 1648.9 1153 1648.7 1155 1649 1156.4 C 1650.5 1162.9 1705.2 1159.8 1713 1166 L 1713.1 1170.9 C 1716.3 1175.7 1758.9 1176.5 1768.7 1178.8 C 1771.1 1181.4 1770.3 1180.8 1770.8 1185.3 C 1774.7 1189.7 1821.4 1191.8 1830.9 1192.7 C 1826.2 1202.7 1820.7 1213.3 1815.8 1223.3 C 1805 1222.6 1789.6 1220.1 1778.6 1218.6 C 1778.2 1273.4 1778.2 1328.1 1778.6 1382.9 C 1717.2 1381.4 1649.7 1382.8 1587.7 1382.8 L 1204.5 1383 L 829.4 1382.5 C 889.9 1289.8 883.8 1130.7 880.7 1023.8 C 888.7 1022.8 934.9 1017.1 939 1015.3 C 939.2 1012 938.8 1013 940.2 1010.4 C 958.8 1005.8 982.3 1004.9 1001.3 1000.6 C 1010 998.4 1014.1 992.5 1023.7 993.6 C 1029.2 993.7 1030.1 998.6 1033 1000.8 C 1041 1006.8 1081 1003 1085.8 1008.6 C 1085.6 1011.5 1085.1 1013.3 1086.6 1015.8 C 1090.2 1018.1 1136.9 1021.7 1145.6 1022.5 L 1145.3 1032.6 C 1154 1033.5 1200.8 1036.4 1205.2 1039.7 C 1205 1042.5 1205 1042.9 1205.4 1045.8 C 1211.3 1050.8 1255 1050.1 1265.2 1054.1 C 1266 1056.9 1265.9 1058.1 1266.1 1061 C 1269.3 1063.9 1300.4 1065.3 1307 1065.8 C 1306.8 1031 1307 996.2 1307.6 961.3 L 1285.2 961 L 1272 938.1 C 1288 938.1 1306.2 937 1322.2 936.3 L 1322.4 923.6 C 1338.6 922.9 1355.4 922.4 1371.5 921 C 1376.2 916 1381.1 914.1 1387.4 912.2 z M 764.8 565.4 C 771 569.1 781.5 608.8 784.1 618.2 C 807.5 700.8 822.1 785.6 832.9 870.8 C 844.6 962.7 853.2 1055.3 850.7 1148.1 C 848.8 1209.9 840.6 1298.6 809.6 1353.7 C 804.8 1362.2 797 1369.7 790 1376.3 C 789.1 1398.2 788.3 1473.6 766.9 1482.3 C 764.8 1481.7 761 1480.4 759.7 1478.7 C 744 1457.9 743.8 1401 743.6 1376.2 C 718.7 1355.2 707.7 1320 700.4 1289.4 C 658.9 1115.1 693.8 846.5 734.4 670.4 C 739.3 648.9 755 581.2 764.8 565.4 z M 643.9 1083.7 L 646.3 1082.2 C 647.4 1078.1 647.4 1077.6 647.4 1073.4 L 648.6 1072.4 C 649.9 1076.3 648.6 1113.8 648.5 1120.8 C 649.6 1196.2 656.4 1277 685.7 1347.8 C 690.5 1359.2 698.1 1371.4 704.6 1382 L 271.8 1382.1 L 271.6 1199.7 C 258.6 1201 245.7 1202.7 232.8 1204.8 C 227.1 1196.5 222 1187 217 1178.1 C 227.6 1176.8 271.6 1173.1 277.3 1170.3 C 277.6 1168 277.7 1166.8 278.2 1164.5 C 284 1159.1 334.1 1158.6 341.5 1154.5 L 342.3 1150.3 C 346.5 1146.7 392.5 1143.2 402.5 1141.7 C 404.9 1139.6 404.1 1139.8 404.7 1135.5 C 409.4 1130.7 458.7 1130.9 465.5 1126.6 L 466.1 1121.1 C 469.7 1116.4 520 1115.3 529 1112 L 529.3 1107.1 C 533.4 1101.4 582 1102.7 587.8 1097.3 C 587.9 1094.3 587.8 1093.8 588.5 1090.8 C 595.5 1087.7 633.7 1084.6 643.9 1083.7 z' },
    room: { at: 'translate(100 100) scale(.0881) translate(-1022 -1040)', d: 'M 860.6 500.4 C 865 499.8 874.2 499.5 878.8 499.9 C 1037.8 512.4 1082.7 717.1 971.4 816 C 968.9 827.6 970.3 840.7 979.2 849.6 C 988.9 858.9 1001.7 850.9 1013.2 850.3 C 1030 849 1033.5 865.5 1033.1 879.1 C 1032.4 899 1013.1 904 1001.4 915.2 C 1011.3 926.9 1036.2 949.8 1048.1 961.2 L 1127.7 1037.9 L 1400.6 1302.9 L 1475 1375 C 1487.2 1387 1499.9 1398.7 1511 1411.7 C 1528.7 1432.5 1526.2 1464.2 1508.4 1484.1 C 1498.6 1494.9 1484.8 1501.1 1470.3 1501.4 C 1442.6 1502 1416.8 1470.5 1396.8 1451.5 C 1376.2 1470.8 1351.3 1500.3 1331.1 1521.7 C 1318.1 1535.4 1287 1567.9 1277.2 1581.7 C 1256.3 1560.3 1235.2 1539.1 1213.8 1518.2 C 1220.3 1511.7 1234.8 1493.9 1239.9 1486.3 C 1235.8 1482 1232.8 1479.6 1228.2 1476 C 1219.5 1486.5 1211.3 1495.9 1202.1 1506 C 1186.3 1490.9 1170.2 1473.9 1154.7 1458.2 C 1147.8 1451.4 1140.9 1444.3 1134.1 1437.4 C 1141.8 1426.1 1156.6 1409.4 1165.8 1398.5 C 1173 1406.3 1180.7 1414 1188.2 1421.7 C 1199.3 1408.8 1210.1 1395 1220.8 1381.7 L 1198.9 1361 C 1214.7 1342.6 1231.1 1324.7 1246.8 1306.2 L 1002.4 1066.5 C 977.8 1042.7 951.3 1016 926.2 993.3 C 918 1002.3 911.4 1014.7 903.5 1022.2 C 884.4 1028.6 862.8 1020.3 858 999.7 C 857.4 996.7 859.1 987.1 859.6 983.7 C 861.8 969.7 846.4 960.2 834.5 958.2 C 829.6 957.4 818 957.8 814.9 961.4 C 805 972.8 799.2 983.2 786.4 992.2 C 748.3 1018.5 701.5 1028.8 655.9 1021 C 611.2 1012.8 571.8 986.9 546.7 949.1 C 497.2 876.1 517.9 787.4 590.1 738.7 C 557 712.9 532.1 691.4 535.6 645 C 540.3 580.9 601 518.1 667.5 522.4 C 704.3 524.8 716.6 543 739.1 568.7 L 744.1 562.6 C 776.2 523.7 809.9 505.2 860.6 500.4 z M 820.1 604.4 C 925.5 594.4 1010.2 751.4 882.7 792 C 879.6 793 873.3 793.3 869.9 793.5 C 852.1 794.7 837.6 794.7 823.1 806.6 C 785.4 837.5 823.2 884.9 782.8 914.8 C 762.6 929.7 741.3 934.7 716.5 931.9 C 711.7 930.9 708 929.9 703.3 928.4 C 673.5 918.5 648.9 897.2 634.7 869.2 C 619.8 839.9 621.7 815.3 631.8 784.9 C 658.7 802.1 683.8 806.9 709.4 782.9 C 724.9 786.6 747.1 792.7 762 786.6 C 802.1 770.1 806.8 726.1 794.7 691 C 817.6 659.9 816.3 641.8 799.1 608.7 C 807.2 606.1 811.8 605.3 820.1 604.4 z M 722.1 628.3 C 733 629.1 743.2 633.3 748.6 643.6 C 751.1 648.3 751.5 653.8 749.6 658.9 C 745.3 671.2 730.8 677.3 719.9 682.7 C 731.5 686.1 744.2 689.9 749.4 702.3 C 752 708.6 751.9 715.7 749.1 721.8 C 739.5 743.3 713.9 738.3 704.9 719.6 C 701.6 712.7 700.5 709.5 698.3 702.2 C 694.4 722 691.5 735.9 670 742.2 C 649.5 742.5 644.1 728.8 645.1 710.9 C 653.1 697.1 667.8 691.9 681.7 685.4 C 673.6 685.2 670.2 684.5 662.5 682.8 C 636.5 677.2 633.6 644.6 658.3 634.8 C 664.6 632.2 671.8 632.4 678 635.4 C 688.7 640.5 692.2 649.8 695.9 660 C 701 645 704.5 631.3 722.1 628.3 z' },
    menu: { at: 'translate(100 100) scale(.0714) translate(-1024 -1026)', d: 'M 626.6 403.7 C 650 420.4 681.7 463.2 696.3 487.5 C 747.4 572.3 762.6 668.8 774.9 765.2 C 776.7 779.9 846.6 894.8 866.3 889.2 C 869.7 885.2 871.2 849.8 872.7 839.9 C 792.9 825.8 775.2 709.3 814 649.8 C 835.5 616.8 873.6 609.4 906.3 631.5 C 920.4 640.5 924.8 655.1 932.8 668.3 C 963.9 719.7 954.5 830.5 881 840.5 C 880.5 873.3 886.8 917.2 904.2 944.9 C 911.5 956.5 921.6 968.4 930.4 978.9 C 943.8 995.2 957.8 1011.1 972.2 1026.5 C 971.8 1008.7 967.6 987.5 965.3 969.5 C 962.1 943.8 960.4 918 960.4 892.1 C 960.4 868.2 962.3 830 966.5 806.5 C 978.7 737.1 1005.7 650.6 1056.2 600 C 1089.6 711.2 1057.1 865.3 1013.2 970 C 1002.9 994.7 991 1013.8 989 1041 C 995.6 1048.8 1003.8 1055 1011.9 1061.3 C 1021.5 1053.7 1030.5 1045.3 1039.4 1036.7 C 1074.8 1003.4 1108.8 965.7 1147.1 935.7 C 1187.2 904.4 1222.6 864.6 1219.4 810.1 C 1217 769.7 1214.1 750.3 1242.1 717.6 C 1267 688.7 1293.4 664.9 1321.1 638.7 C 1362.9 599.3 1405 560.1 1447.3 521.2 L 1509.1 462.8 C 1519 453.6 1534.7 438.4 1545.5 431.5 C 1556 429.9 1563.1 442.4 1556.1 451.1 C 1550.5 458 1544.4 464.4 1538.4 471 L 1504.7 507.6 C 1457.2 558.8 1409.3 609.7 1361.1 660.2 C 1348 674.2 1334.1 688.3 1321.8 702.7 C 1318.2 709.6 1324.6 719.5 1330.6 721.5 C 1339.8 724.5 1346.8 712.4 1352.9 705.5 C 1358.5 699.2 1364.2 693.1 1370.2 687.1 C 1424.6 631.5 1479.4 576.3 1534.6 521.4 C 1548.1 507.9 1561.7 494.4 1575.3 481 C 1581.2 475.3 1586.6 468.7 1595.5 472.3 C 1603.1 475.4 1605.4 484 1600.3 490.5 C 1594.2 498.2 1587.3 505.2 1580.7 512.4 L 1546.3 549.7 L 1413.9 690.4 C 1403.8 700.9 1364.9 739.1 1360.1 750.2 C 1360.4 753.3 1360.8 755.4 1362.6 758.2 C 1364.3 760.9 1367 762.8 1370.1 763.4 C 1381.4 765.6 1392.5 749.8 1399.8 742.2 C 1409.1 732.6 1418.5 723.1 1428.1 713.8 C 1450.6 691.6 1470.6 670.1 1492.6 647.6 L 1585.2 553.4 C 1599.4 539 1614.5 522.6 1629.7 509.8 C 1635.8 504.8 1652.5 515 1641.5 528.2 C 1636.3 534.5 1628.6 543.3 1622.9 549.6 L 1588.3 588 L 1444.6 746.5 C 1438.7 753 1434 758 1426.9 766.2 C 1418.2 776.1 1396.2 792 1413.9 805.7 C 1417 808.1 1425.2 807.4 1428 804.7 C 1444.8 788.8 1463.1 767.5 1478.6 750.5 C 1528.9 695.1 1580.1 640.5 1632 586.7 C 1639.4 579 1666 549.9 1673.3 546.5 C 1683 545.8 1689.6 556.5 1684.8 563 C 1670.5 582.7 1654 601.8 1638.2 620.5 L 1487 799.4 C 1468.5 821 1450.1 843.4 1431.1 864.5 C 1405.9 892.6 1385.3 914.2 1344.8 910.4 C 1329.2 908.6 1314.9 906.6 1299 907.2 C 1237.9 909.8 1209.8 942.4 1171.7 984.8 C 1158 1000 1144.1 1015 1130 1029.9 C 1000.1 1167.1 875.6 1304 760.6 1454.3 C 737.3 1484.8 714.7 1515.9 693 1547.5 C 679.8 1566.7 664.3 1591.4 649.6 1608.7 C 632.7 1627.8 605.6 1644.8 579.8 1645.7 C 535 1647.3 492 1607 492.1 1561.9 C 492.1 1537.5 502.9 1510.2 518.9 1491.8 C 533 1475.5 552.2 1462.8 568.5 1448.8 C 599.3 1423.6 631.5 1399.4 662.2 1374 C 744.8 1305.8 825.5 1235.4 904.4 1162.8 C 934.7 1135 971.8 1102.5 1000.2 1072.8 C 989.3 1068.3 972.5 1064 960.9 1062.2 C 936.6 1079.8 888.4 1106.2 860.9 1119.5 C 765.9 1165.3 700.1 1193.8 593.4 1181.1 C 603.5 1168 623.4 1148.2 636.7 1137.7 C 709.6 1080.6 795.1 1042 888.9 1041.5 C 918.8 1041.4 946.2 1044.8 975.7 1047.8 C 966.7 1041.4 959.2 1030.9 951.6 1025.8 C 921.9 1005.8 880.4 983.5 847.6 969.8 C 841.7 999.3 815.3 1020.1 785.7 1022 C 743.9 1024.5 703.6 1012.9 670.8 986.2 C 639.8 961 624.4 916.6 652.4 883.1 C 667.5 866 697.3 859.7 718.6 858.4 C 763.4 855.4 821.7 872 841 916.7 C 847.6 932.1 848.1 944.6 848.9 960.9 C 873 966.5 889.2 972.1 912.3 980.6 C 905.9 971.5 895.4 959.7 887.9 950.7 L 846.2 898.9 C 834.2 884.2 819.6 863.4 807.5 850.1 C 796.9 842.4 776 828.3 764 825.2 C 707.8 811 649.7 805.7 593.7 791.2 C 520.8 772.3 452.8 738.2 398.6 685.3 C 384.3 671.3 369.4 655.3 359.2 637.9 C 405.1 634.4 440.7 642.5 484 653 C 560.5 671 630.8 706.1 695.3 750.7 C 719 767.2 740.4 786.2 762.7 804.3 C 764.2 805.5 781 812.4 784 813.8 C 777.2 802.2 770.5 787.4 763.3 776.6 C 756.5 767.6 748.2 759.4 741.1 750.8 C 675.6 671.9 631.6 574.5 624.3 471.6 C 622.8 450.3 622.1 424.8 626.6 403.7 z M 1075.5 1111.1 C 1078.3 1113.8 1085.8 1124.4 1088.6 1128 C 1099 1141.8 1109.8 1155.1 1122.9 1166.4 C 1142.8 1183.5 1166 1193.6 1189 1205.7 C 1209.8 1216.6 1230.3 1228.3 1250.3 1240.6 C 1405 1336.3 1488.2 1439 1557.4 1605.9 L 1545.8 1600 C 1448.4 1555.5 1371.3 1508 1296 1430.5 C 1265.4 1399.1 1245.5 1377.2 1219.7 1340.7 C 1191.5 1300.6 1171.5 1258.9 1143.7 1219.2 C 1118.9 1183.7 1087.8 1160.3 1058.3 1130.5 C 1063.9 1123.3 1069.1 1117.6 1075.5 1111.1 z' },
    table: { at: 'translate(100 100) scale(.1754) translate(-1024 -1024)', d: 'M 1007.5 832.1 C 1112.6 822.6 1205.5 900 1215.1 1005.1 C 1224.7 1110.2 1147.3 1203.1 1042.2 1212.7 C 937.1 1222.3 844.1 1144.8 834.6 1039.8 C 825 934.7 902.4 841.7 1007.5 832.1 z M 1015.6 692.4 C 1048.8 689.8 1125 703.5 1099.2 753 C 1101.8 766.6 1102.1 769 1095.2 781 C 1107.1 789.7 1107.7 814.5 1101.2 826.6 L 1098 827 C 1090.3 823.9 1093.3 815.6 1093.1 808.6 C 1092.2 760.6 1086.6 746.4 1037.2 739.8 C 1018.3 738.6 988.9 740.8 972.7 752.6 C 956.3 764.9 958.7 789.1 957.9 807.4 C 957.7 814.1 962.1 821.7 955 826 C 950.8 826.1 952.6 826.7 949.3 824.9 C 946.3 820.6 945.6 809.5 945.4 804.3 C 945.1 794.9 949.1 788.3 955.8 782.2 C 955.9 779.6 953.2 776.9 951.4 774.4 C 950.2 765.2 950.2 761.4 950.6 752.1 C 927.5 709.8 985.4 694.9 1015.6 692.4 z M 1095.4 1219.5 C 1107.1 1220.3 1105.1 1230.7 1105.4 1240.4 C 1105.8 1254.1 1103.1 1258 1093.8 1267 L 1094.6 1269.1 C 1106.5 1275.7 1096.5 1290.2 1099.7 1296.1 C 1121.8 1337.7 1065.2 1353.1 1032.4 1354.6 C 1009 1355.7 972.9 1349.9 951.7 1330.2 C 942 1317 945.3 1306.1 951.7 1292.4 C 950.1 1286 949.5 1271.4 955 1266.9 C 962.8 1268.1 960.5 1281.3 966 1286.7 C 993.1 1312.2 1051.7 1312.2 1081 1290.8 C 1099.6 1277.3 1086.8 1227.3 1095.4 1219.5 z M 1224.4 1044.6 C 1236.3 1047.8 1255.3 1056.3 1250.7 1071.6 L 1251.8 1072.8 C 1263 1070.8 1268.1 1074.4 1276.2 1082 C 1305.2 1083.3 1311.9 1097.2 1310.8 1125 C 1309.3 1159.6 1296.8 1191.9 1270.1 1214.9 C 1250.6 1231.6 1231.5 1241.2 1213.3 1217 C 1193.1 1215.7 1201.8 1209.9 1191 1201.6 C 1185.9 1202.8 1186.1 1206.3 1179.2 1204.5 C 1170.2 1202.2 1157.2 1196.1 1154.9 1186.1 C 1155.8 1182.7 1154.9 1184.2 1158 1181.8 C 1172.4 1180.6 1206.2 1226 1238 1185.7 C 1256.4 1162.3 1270.1 1135 1269.3 1103.2 C 1269 1091.8 1258.6 1082.5 1250.9 1075.3 L 1247.2 1071.5 C 1238.2 1064.2 1233.5 1060.6 1223 1055.6 C 1223.4 1052 1223.8 1048.2 1224.4 1044.6 z M 807.5 818.1 C 822.5 816.8 825.8 821.2 834.8 832.3 C 860.5 834.6 845.2 849.5 865.6 846.8 C 875.6 845.4 888.9 852.1 893.1 861.4 C 892.6 864.7 892 864.8 889.8 867.2 C 888.9 867.6 888.1 867.9 887.3 868.2 C 881.6 865 875.8 861.8 869.9 858.9 C 864.2 856 858.3 853.6 852.3 851.3 C 846.8 849.2 841.2 847.8 835.6 846.4 C 804.9 856.8 787.6 900.4 781.1 929.2 C 778.3 942.9 776.5 957.4 786.8 968.5 C 790.2 972.2 793.1 973.8 795.9 978.1 L 795.4 979.9 C 785.5 984.9 777.6 977.3 771.3 971 C 757.6 971.4 743.7 966.1 740.6 951.6 C 729.5 899.6 756 835.8 807.5 818.1 z M 787.7 1072 C 791.5 1072 794.8 1071.5 796.5 1075.2 C 791.3 1087 778 1085.9 779.2 1105 C 781.3 1139.6 794.8 1171.5 819.5 1195.9 C 843.9 1219.9 871.6 1185.9 890.8 1184.7 C 893.6 1187.4 892.7 1185.8 893.6 1189.6 C 891 1200.9 868.1 1211.8 857.3 1203.5 C 851.8 1215.6 847.3 1217.7 834.5 1218.3 C 827.4 1229.1 817.5 1236.8 803.9 1231.3 C 757.6 1212.4 729.1 1147.8 741 1100.3 C 744.7 1085.2 756.9 1082.8 770.1 1082.4 C 769.2 1082.4 785.6 1073 787.7 1072 z M 1250.3 979.9 C 1259.5 972.3 1269.4 965.1 1270.1 952 C 1271.7 922 1256.5 887.4 1237.6 864.8 C 1231.4 857.4 1223 848.9 1213.4 848.2 C 1207.8 847.9 1199.2 851.6 1194.1 851.5 C 1192.3 847.5 1192.6 849.6 1193 845.1 C 1199.4 834 1211.8 834.7 1214.7 831.2 C 1226 815.5 1240.8 814.5 1257.5 824.9 C 1293.1 847.3 1311.4 891 1311.3 932 C 1311.3 958.3 1304.4 970.9 1277.2 971.3 C 1268.8 979.9 1265.6 983.1 1252.8 981.7 L 1250.3 979.9 z M 971 1222.3 C 1011.2 1233.4 1041.6 1231.1 1081.3 1222.7 C 1083.8 1243.7 1083 1266.5 1071.5 1284.8 C 1056 1301.4 1031.1 1301.7 1010 1299.1 C 970.4 1294.3 964.8 1255 971 1222.3 z M 1022.8 745.4 C 1040.1 744.7 1063.9 749.3 1073.4 765 C 1082.5 780.1 1084.1 804.8 1080.7 821.6 C 1061.9 816.5 1047.9 815.2 1028.9 814.4 C 1006.6 814.4 991.8 816.3 970.3 821.7 C 967.1 803.5 968.1 775.8 980.3 760.9 C 990.2 748.9 1008.3 746.7 1022.8 745.4 z M 827.2 1067.8 C 829.3 1068.5 832.4 1085.1 833.6 1089 C 843.2 1120.6 862.4 1149.3 883.1 1174.6 C 869.4 1183.9 860.6 1187.4 844.5 1191 C 811.4 1193.4 799.4 1163.3 790.6 1137.2 C 779.5 1104.1 800.8 1083.2 827.2 1067.8 z M 1220.6 1066.9 C 1237 1075.3 1259.9 1094.8 1261.1 1114.6 C 1262.3 1134.2 1252.2 1158.5 1239.9 1173.6 C 1231.2 1184.3 1222.3 1188.9 1208.8 1190.1 C 1192.7 1187.5 1179 1183.1 1167 1171.5 C 1171.5 1163.9 1182.7 1149.9 1188.4 1141.7 C 1205.9 1116.7 1212.9 1095.7 1220.6 1066.9 z M 830.1 861.2 C 851 858.3 864.2 867.1 880.3 878.1 C 850.4 914.4 838 934.3 828.7 980.9 L 827.6 985.1 C 821.3 987.5 810 975.6 805.3 971.6 C 783.5 952.9 782.9 929.8 793.3 904.9 C 801.4 885.7 810.2 869.9 830.1 861.2 z M 1208.7 861.3 C 1222.6 861.1 1235.5 869.9 1242.4 881.4 C 1273.4 933.5 1268.8 955.1 1222.1 986.9 C 1219.5 979.9 1218.2 967.8 1215.6 960.1 C 1204.2 925.8 1190.3 904.2 1167.9 877.2 C 1181.7 867.5 1192.2 863.5 1208.7 861.3 z M 951.9 1219.9 C 952.5 1219.9 953.1 1219.9 953.7 1220 C 954.8 1220 955.9 1219.9 957 1220.2 C 957.6 1220.3 958.5 1220.7 958.7 1221.3 C 959.2 1223.4 958.9 1264.4 958.7 1264.6 C 958 1265.4 956 1265.7 955.2 1265.8 C 944.7 1253.8 943.3 1233.1 951.9 1219.9 z M 1183.3 845.2 C 1189.7 845.6 1189.3 847.2 1192 853 C 1178.2 858.9 1176.3 860.2 1163.5 867.4 C 1159.1 867.9 1153.1 861.8 1155.7 858.8 C 1163.6 850 1172.2 847 1183.3 845.2 z M 798 980.8 C 800.6 982.1 822.3 996.9 825.3 999.2 C 825.1 1004 825.1 1006.3 824.2 1011 C 811 1006.6 792.8 997.6 798 980.8 z M 822.5 1045 C 826 1045.9 825.7 1050.7 826.1 1053.9 L 826.4 1055.8 C 814.7 1062.3 811.3 1065.3 800.5 1073.2 C 792.3 1073.6 799.3 1050.7 822.5 1045 z M 1249.3 981.4 C 1250.6 982.5 1251.8 983.5 1253.1 984.6 C 1251.8 1001.7 1219.6 1019.8 1224.1 999 C 1224.1 999 1245.6 984.6 1249.3 981.4 z' },
    film: { at: 'translate(100 100) scale(.0560) translate(-1048 -990)', d: 'M 894.6 302.4 C 1050.2 296.9 1201.2 348 1325.9 439.8 C 1468.9 546.2 1564.8 704.2 1593.1 880.2 C 1617.8 1041.5 1585.9 1206.5 1502.8 1347 C 1488.8 1370.6 1473.6 1391.7 1457.4 1413.7 C 1497.2 1414 1539.3 1412.7 1579.1 1412 L 1696.4 1410.6 L 1759.3 1409.8 C 1770.8 1409.7 1786 1408.7 1797.3 1410.2 C 1845.7 1416.7 1862.2 1458.5 1862.7 1500.7 L 1862.9 1560.8 C 1862.9 1578 1864.1 1606.9 1860.3 1622.2 C 1857 1635.7 1850.1 1648 1840.3 1657.8 C 1815.6 1682.7 1788 1678.4 1755.6 1678.6 L 1666.2 1679 L 1349.2 1679.6 L 1051.4 1679.7 C 999.7 1679.6 931.6 1682 881.4 1678.5 C 826 1674.7 771.2 1664.5 718.2 1647.9 C 615.1 1616.6 538.9 1574.8 459 1502.4 C 322.5 1379.3 240.7 1207 231.6 1023.5 C 224.4 841.1 289.2 663.3 412 528.3 C 535.9 391.1 709.9 309.7 894.6 302.4 z M 896.8 430.2 C 983.8 420.6 1062.2 483.3 1072 570.3 C 1081.8 657.3 1019.3 735.8 932.3 745.7 C 845.1 755.7 766.3 693 756.5 605.7 C 746.7 518.5 809.6 439.8 896.8 430.2 z M 664.3 1159.4 C 751.5 1152.7 827.8 1217.8 834.8 1305.1 C 841.7 1392.3 776.7 1468.7 689.5 1475.9 C 602 1483 525.3 1417.8 518.3 1330.3 C 511.3 1242.8 576.7 1166.2 664.3 1159.4 z M 1278 708.8 C 1365 702.6 1440.7 768.1 1446.9 855.2 C 1453.1 942.3 1387.5 1017.9 1300.5 1024.1 C 1213.4 1030.3 1137.8 964.7 1131.6 877.7 C 1125.3 790.6 1190.9 715 1278 708.8 z M 529.2 710.2 C 616.3 705.3 691 771.8 696 858.9 C 701 945.9 634.6 1020.6 547.5 1025.7 C 460.3 1030.8 385.5 964.3 380.5 877.1 C 375.5 789.9 442.1 715.2 529.2 710.2 z M 1144.6 1160.7 C 1231.6 1155.2 1306.4 1221.4 1311.7 1308.4 C 1316.9 1395.4 1250.5 1470 1163.5 1475 C 1076.8 1480 1002.5 1413.9 997.3 1327.2 C 992.1 1240.6 1058 1166.1 1144.6 1160.7 z M 898.3 874.9 C 960.7 867.8 1017 912.8 1024 975.2 C 1030.9 1037.6 985.9 1093.8 923.4 1100.7 C 861.2 1107.5 805.1 1062.6 798.2 1000.4 C 791.3 938.1 836 882 898.3 874.9 z M 1405.9 1468 C 1439 1468.1 1480.5 1466.6 1513 1468.6 L 1513.6 1615.7 L 1502.2 1615.9 L 1393.2 1616.6 C 1392.9 1610 1392.9 1602.7 1393 1596.1 C 1393.8 1557.5 1392 1517.8 1393.8 1479.3 C 1397.6 1475 1401.5 1471.8 1405.9 1468 z M 1699 1466.2 C 1714.5 1465.9 1799.9 1464.5 1808.8 1468.2 C 1815 1477.6 1813.6 1512.5 1813.7 1524.6 C 1814.1 1554.7 1814.1 1584.7 1813.8 1614.7 C 1778.3 1615.9 1734.8 1615 1699 1615 L 1699 1466.2 z M 1549.2 1466.4 C 1580.3 1465 1630.4 1465.6 1661.8 1466.5 L 1662 1561.8 C 1662 1578.7 1662.5 1598.8 1661.7 1615.4 C 1626 1616.8 1585.8 1616 1549.9 1616.1 C 1548.9 1568.2 1549 1514.4 1549.2 1466.4 z M 359 983.6 C 366.6 989.8 383.2 1024.5 390.3 1034.6 C 449.1 1117.7 466.1 1213.7 461.7 1314.5 C 392.2 1209.4 352.6 1111.7 359 983.6 z M 1088.1 456.5 C 1105.1 461.1 1122.4 469.5 1138.7 476.5 C 1238 519 1305.7 583.8 1369.5 668.5 C 1360.8 666.2 1351.5 660.4 1343 657.3 C 1237.4 618.8 1152.8 548.1 1088.1 456.5 z M 747.2 456.1 L 747.6 457.7 C 740 469.8 718.3 493.2 707.9 504.8 C 659.1 559.6 600.3 604.7 534.7 637.6 C 512.5 648.8 488.3 658.6 465.3 670 L 464.5 668.9 C 468.5 661.6 485.2 640.1 491 633 C 538.5 573.5 598.1 524.9 666 490.4 C 695.4 475.4 718.4 468.9 747.2 456.1 z M 1468.6 986.9 L 1469.4 988.1 C 1473.3 1108.2 1435.8 1208 1372.5 1307.3 C 1372.4 1307 1372.3 1306.7 1372.2 1306.3 C 1364 1233.6 1375.6 1165.4 1405.9 1098.9 C 1424.1 1059 1446.6 1024.6 1468.6 986.9 z M 887.6 1494.4 C 894.8 1493.6 909.5 1493.8 917 1493.7 C 972.7 1493.6 1021.3 1503.9 1073 1523.3 C 1041.2 1536.7 974.7 1545.2 940.2 1547 C 871.9 1549.2 816.5 1542 750.9 1523.3 C 791.8 1507.6 844 1497.4 887.6 1494.4 z M 1354 1514.9 C 1356.3 1518.6 1355.8 1603.1 1355.8 1616.1 L 1245.1 1616.7 L 1244.5 1616.5 C 1241.8 1613.2 1243 1594.6 1243.1 1589 C 1282.9 1568.9 1320.9 1544.9 1354 1514.9 z M 1205.7 1608 C 1207 1609.3 1206.8 1609.2 1207 1611 C 1207.9 1619 1203.8 1616.9 1195.2 1616.7 C 1189.6 1613.2 1204 1608.7 1205.7 1608 z' },
    photos: { at: 'translate(100 100) scale(.0635) translate(-1034 -952)', d: 'M 1009.3 670.4 C 1253.6 658.2 1461.6 846.1 1474.1 1090.4 C 1486.6 1334.7 1298.8 1542.9 1054.5 1555.6 C 810 1568.3 601.5 1380.2 589 1135.7 C 576.5 891.1 764.7 682.7 1009.3 670.4 z M 1008 868.9 C 1140.1 856.2 1257.4 952.9 1270.3 1085 C 1283.1 1217 1186.6 1334.5 1054.5 1347.5 C 922.2 1360.5 804.5 1263.8 791.6 1131.5 C 778.8 999.2 875.7 881.6 1008 868.9 z M 868 345.4 C 886.1 344.4 911.9 345.1 930.6 345.1 L 1048.5 345.1 L 1149.6 345.2 C 1176.5 345.2 1213.7 342.3 1237.7 353.4 C 1255.4 361.6 1270.5 374.5 1281.3 390.7 C 1291.3 405.9 1309.6 458.2 1316.6 476.8 L 1361.7 597 L 1430.7 597 C 1433.5 574.6 1437.7 558.3 1452 540.8 C 1479 507.4 1510.3 506.4 1549.7 507 C 1582.6 507.5 1607.2 505.4 1634.3 528.9 C 1655.7 547.3 1663.6 567.9 1665.7 595.2 C 1743.1 611.6 1806.1 672.8 1817.8 752.8 C 1819.9 767 1819 783.8 1818.8 798.2 L 1423.1 798 C 1370.5 735.3 1315.3 692.7 1242.2 657.5 C 1166.7 621.7 1083.2 605.9 999.8 611.4 C 892 618.9 789.5 660.7 707.2 730.7 C 681.2 752.9 663.3 772.5 640.8 798 L 249.4 798 C 249.3 796.2 249.3 794.5 249.3 792.8 C 249.4 737.7 266 693.5 304.2 653.6 C 368.1 586.7 436.1 597.1 519 597.1 L 705.3 596.9 C 721.7 555.8 737.1 513.6 753.1 472.4 C 761 452.1 769.7 424.2 778.9 405.3 C 783.5 395.7 789.4 386.8 796.5 378.7 C 816.6 356.1 838.6 347.3 868 345.4 z M 910.6 415.4 C 935.6 413.9 972.1 415 998 415 L 1159.4 415.1 C 1159.8 456.9 1159.4 500.2 1159.3 542.1 L 911.2 541.7 C 911 534.4 911 526.5 911.1 519.2 C 911.5 484.7 909.8 449.8 910.6 415.4 z M 1483.8 861.5 L 1818.7 861.7 L 1818.8 1234.4 L 1818.9 1317 C 1819.3 1391.4 1819 1440.9 1762.2 1499.3 C 1696.3 1567 1631.5 1558.6 1545.5 1558.8 L 1365.7 1558.5 C 1335 1558.3 1301.5 1559.1 1271.1 1558 C 1396 1487.9 1479.7 1379.2 1520.7 1242.3 C 1560.6 1109.1 1534 981.8 1470 861.8 L 1483.8 861.5 z M 249.3 861.5 L 593 861.7 C 533.4 962.6 512.4 1092.9 533.9 1207.7 C 559.4 1343.5 637.2 1455.2 750.5 1532.7 C 762.8 1541.5 778.8 1551 791.8 1558.6 L 455.1 1558.8 C 396.5 1558.5 347.1 1541.6 305.2 1499 C 278.4 1472.1 260.2 1437.9 252.8 1400.7 C 248.1 1377.7 249.1 1342 249.1 1317.4 L 249.1 1213.9 L 249.3 861.5 z M 413.6 488.7 L 634.2 489 C 634.1 508.9 635.5 530.5 634.5 550.2 C 561.5 551.6 486.9 550.3 413.7 550.1 C 412.9 532.1 413 506.8 413.6 488.7 z' }
  };
  const sealFor = key => {
    const e = EMBLEMS[key];
    if (!e) return WAX;
    const id = 'fh-emb-' + key;
    return '<svg class="fh-wax" viewBox="-20 -20 240 240" aria-hidden="true" focusable="false"><defs><path id="' + id +
      '" fill-rule="evenodd" transform="' + e.at + '" d="' + e.d + '"/></defs><use href="#fm-seal-wax"/>' +
      '<use href="#' + id + '" x="1.6" y="1.8" fill="#2a0604" fill-opacity=".75"/><use href="#' + id + '" fill="url(#fm-gild)"/></svg>';
  };

  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const haptic = p => { try { if (root.navigator.vibrate) root.navigator.vibrate(p); } catch (e) { /* no haptics */ } };
  const nameSize = text => (text.length > 28 ? 'longer' : text.length > 16 ? 'long' : '');

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function button(cls, text, onClick) {
    const b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  let current = null, listening = false;

  // The minute's own sound button sits over every screen; the home screen has its own in its place.
  function minuteSound(host, hide) {
    const b = host && host.querySelector('.fm .fm-sound');
    if (b) b.hidden = hide;
  }

  // Takes the home screen away: any open card closes, its clock and toast stop, and the minute's sound button comes back.
  function clear() {
    const cards = root.sjFirst && root.sjFirst.cards;
    if (cards && typeof cards.close === 'function') cards.close({ quiet: true });
    const r = current;
    current = null;
    if (!r) return;
    root.clearInterval(r.clock);
    root.clearTimeout(r.toastTimer);
    r.anims.forEach(a => { try { a.cancel(); } catch (e) { /* already gone */ } });
    if (r.box.parentNode) r.box.parentNode.removeChild(r.box);
    minuteSound(r.host, false);
  }

  function show(opts) {
    const o = opts || {}, first = root.sjFirst || {}, w = first.words, S = first.sound;
    const ctx = o.ctx || {};
    if (typeof ctx.now !== 'function') ctx.now = Date.now;
    clear();
    if (first.reply && typeof first.reply.clear === 'function') first.reply.clear();
    const host = o.root;
    const box = el('div', 'fh');
    host.appendChild(box);
    host.hidden = false;
    minuteSound(host, true);
    const r = { box, host, ctx, clock: 0, toastTimer: 0, toastGen: 0, anims: [], counting: false, seq: 0 };
    current = r;
    const live = () => current === r;
    const REDUCE = reduced();

    function anim(e, frames, a) {
      if (!e || !e.animate) return null;
      const made = e.animate(frames, Object.assign({ duration: 700, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' }, a));
      r.anims.push(made);
      made.addEventListener('finish', () => { const i = r.anims.indexOf(made); if (i >= 0) r.anims.splice(i, 1); });
      return made;
    }
    const rise = (e, delay, d) => anim(e, REDUCE ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: d || 700, delay: delay || 0 });

    const s = el('section', 'fm-screen fh-trip');
    s.setAttribute('aria-labelledby', 'fh-h');
    box.appendChild(s);
    const inner = el('div', 'fh-inner');
    s.appendChild(inner);

    // Hello: the kicker and the household's name.
    const hello = el('header', 'fh-hello');
    const name = first.coverLine ? first.coverLine(ctx.invite) : '';
    const kicker = el('p', 'fm-kicker', w.home.kicker);
    const h = el('h2', 'fh-name', name || w.home.kicker);
    h.id = 'fh-h';
    h.tabIndex = -1;
    const size = nameSize(h.textContent);
    if (size) h.setAttribute('data-size', size);
    kicker.hidden = !name;
    hello.appendChild(kicker);
    hello.appendChild(h);
    inner.appendChild(hello);

    // The big countdown and the small one.
    const count = el('div', 'fh-count');
    const days = el('span', 'fh-count-n', '0');
    const side = el('span', 'fh-count-side');
    const daysLabel = el('span', 'fh-count-l');
    const clockEl = el('span', 'fh-clock');
    side.appendChild(daysLabel);
    side.appendChild(clockEl);
    const todayEl = el('span', 'fh-today', w.home.today);
    todayEl.hidden = true;
    count.appendChild(days);
    count.appendChild(side);
    count.appendChild(todayEl);
    inner.appendChild(count);
    const next = el('p', 'fh-next');
    const nextIcon = el('span', 'fh-next-i');
    nextIcon.innerHTML = ICON.lock;
    const nextText = el('span', 'fh-next-t');
    next.appendChild(nextIcon);
    next.appendChild(nextText);
    const remind = el('a', 'fh-remind', w.home.remind);
    remind.setAttribute('aria-label', w.home.remindLabel);
    next.appendChild(remind);
    inner.appendChild(next);

    // The envelopes: each sealed one says when it opens.
    const grid = el('div', 'fh-envs');
    const envButtons = envelopes(ctx.now(), w).map(env => {
      const b = button('fh-env fh-' + env.state, null, () => tapEnvelope(b, env));
      b.setAttribute('aria-label', env.label);
      b.innerHTML = FLAP + sealFor(env.key);
      b.appendChild(el('span', 'fh-env-t', env.name));
      b.appendChild(el('span', 'fh-env-d', env.stamp));
      grid.appendChild(b);
      return b;
    });
    inner.appendChild(grid);

    // The dock.
    const dock = el('nav', 'fh-dock');
    dock.setAttribute('aria-label', w.dock.label);
    const dockButtons = DOCK_KEYS.map((key, i) => {
      const b = button('fh-dk', null, () => openCard(key, b));
      const ico = el('span', 'fh-ico');
      ico.innerHTML = ICON[DOCK_ICONS[i]];
      b.appendChild(ico);
      b.appendChild(el('span', 'fh-dk-t'));
      dock.appendChild(b);
      return b;
    });
    inner.appendChild(dock);

    // The foot: Questions and watch again.
    const foot = el('div', 'fh-foot');
    const questions = button('fh-link', w.home.questions, () => openCard('questions', questions));
    foot.appendChild(questions);
    foot.appendChild(button('fh-link', w.home.watch, watchAgain));
    inner.appendChild(foot);

    const soundBtn = button('fm-round fh-sound', null, () => { if (!S) return; S.unlock(); S.toggle(); soundIcon(); });
    box.appendChild(soundBtn);
    function soundIcon() {
      const on = !!(S && S.on());
      soundBtn.innerHTML = on ? ICON.soundOn : ICON.soundOff;
      soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      soundBtn.setAttribute('aria-label', on ? w.minute.soundOn : w.minute.soundOff);
    }
    soundIcon();

    const toastEl = el('p', 'fh-toast');
    toastEl.setAttribute('role', 'status');
    toastEl.hidden = true;
    box.appendChild(toastEl);

    // from: the control that opened the card, so focus goes back to it when the card closes.
    function openCard(key, from) {
      const cards = first.cards;
      if (cards && typeof cards.open === 'function') cards.open(key, ctx, { root: host, from });
    }
    function tapEnvelope(b, env) {
      if (!REDUCE) anim(b, [{ transform: 'none' }, { transform: 'translateX(-6px) rotate(-1deg)' }, { transform: 'translateX(5px) rotate(1deg)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(2px)' }, { transform: 'none' }], { duration: 500, easing: 'ease', fill: 'none' });
      if (S) S.pop(0.4);
      haptic([8, 40, 8]);
      toast(env.toast);
    }
    function toast(text) {
      const gen = ++r.toastGen;
      toastEl.textContent = text;
      toastEl.hidden = false;
      anim(toastEl, [{ opacity: 0, transform: 'translate(-50%, 10px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 300 });
      root.clearTimeout(r.toastTimer);
      r.toastTimer = root.setTimeout(() => {
        if (!live() || gen !== r.toastGen) return;
        const a = anim(toastEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
        if (a) a.onfinish = () => { if (gen === r.toastGen) toastEl.hidden = true; }; else toastEl.hidden = true;
      }, TOAST_MS);
    }
    function watchAgain() {
      if (!first.minute) return;
      clear();
      first.minute.play({ root: host, invite: ctx.invite, onDone: () => land(host, ctx) });
    }

    function paintDock() {
      dockItems(ctx.household, w, travelStamped(ctx)).forEach((item, i) => {
        const b = dockButtons[i];
        b.className = 'fh-dk fh-' + item.state;
        b.setAttribute('aria-label', item.aria);
        b.lastChild.textContent = item.label;
      });
    }
    function tick() {
      const now = ctx.now(), c = bigCount(now, w), line = nextLine(now, w);
      // On the wedding day the countdown says so; after it, the countdown goes.
      const day = core.weddingDay(now);
      count.hidden = day === 'after';
      days.hidden = side.hidden = day !== 'before';
      todayEl.hidden = day !== 'today';
      if (!r.counting) days.textContent = String(c.days);
      daysLabel.textContent = c.label;
      clockEl.textContent = c.clock;
      next.hidden = line === null;
      if (line !== null) nextText.textContent = line;
      const href = remindHref(now, root.navigator && root.navigator.userAgent, w);
      remind.hidden = !href;
      if (href && remind.getAttribute('href') !== href) {
        remind.setAttribute('href', href);
        if (href === DATES_FILE) { remind.removeAttribute('target'); remind.removeAttribute('rel'); }
        else { remind.target = '_blank'; remind.rel = 'noopener'; }
      }
      return c.days;
    }
    function countUp(to) {
      if (REDUCE || !root.requestAnimationFrame || !to) return;
      r.counting = true;
      const t0 = root.performance.now();
      const step = t => {
        if (!live()) return;
        const k = Math.min(1, (t - t0) / COUNT_UP_MS);
        days.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
        if (k < 1) root.requestAnimationFrame(step); else r.counting = false;
      };
      days.textContent = '0';
      root.requestAnimationFrame(step);
    }

    r.paint = paintDock;
    r.toast = toast;
    paintDock();
    countUp(tick());
    r.clock = root.setInterval(() => { if (live()) tick(); }, 1000);
    [hello, count, next].forEach((e, i) => rise(e, 80 + i * 90));
    envButtons.forEach((e, i) => rise(e, 300 + i * 70, 650));
    [dock, foot].forEach((e, i) => rise(e, 380 + i * 90));
    root.setTimeout(() => { if (live()) { try { h.focus({ preventScroll: true }); } catch (e) { /* not focusable yet */ } } }, 350);
    // A card asked for by the screen before (only 'reply'): opened after the rise, only if home is still the screen
    // and no card is open (one the guest opened meanwhile is never replaced).
    if (o.open) {
      root.setTimeout(() => {
        const cards = first.cards;
        if (live() && cards && typeof cards.open === 'function' && !(typeof cards.openKey === 'function' && cards.openKey())) cards.open(o.open, ctx, { root: host, from: dockButtons[DOCK_KEYS.indexOf(o.open)] });
      }, OPEN_AFTER_MS);
    }
    listen();
  }

  // Reads the household, then lands: home with the fresh answer, the can't-come screen for a no.
  // A save that lands while the read is out wins: the read is dropped and the household as it is now decides.
  function land(host, ctx) {
    const first = root.sjFirst || {}, token = ctx.invite && ctx.invite.token;
    const done = household => {
      const next = afterRefresh(household, ctx.now());
      if (next !== 'keep') ctx.household = household;
      if (next === 'render' || next === 'keep') show({ root: host, ctx });
      else first.reply.show({ root: host, ctx, mode: next });
    };
    if (!token || !first.store) { done(undefined); return; }
    readFresh({ seq: 0, ctx }, first.store.load, done, () => done(ctx.household));
  }

  // Applies a read only if it is the newest one and the household was not replaced meanwhile; otherwise stale() if given.
  function readFresh(r, load, apply, stale) {
    const seq = ++r.seq, householdAtStart = r.ctx.household;
    return load(r.ctx.invite.token).then(function (household) {
      if (seq !== r.seq || r.ctx.household !== householdAtStart) { if (typeof stale === 'function') stale(); return; }
      apply(household);
    });
  }

  // A short message on the home screen (a card's save that failed after the card was closed).
  function toastHome(text) {
    if (current && typeof current.toast === 'function') current.toast(text);
  }

  // Paints the dock again from ctx.household, without a read (after a card has saved).
  function repaint() {
    if (current && typeof current.paint === 'function') current.paint();
  }

  function refresh() {
    const r = current, first = root.sjFirst || {};
    const token = r && r.ctx.invite && r.ctx.invite.token;
    if (!token || !first.store) return Promise.resolve();
    return readFresh(r, first.store.load, function (household) {
      if (current !== r) return;
      const next = afterRefresh(household, r.ctx.now());
      if (next === 'keep') return;
      const changed = stayChanged(r.ctx.household, household);
      r.ctx.household = household;
      // cantcome, ask or closed: the home screen (and any card) goes.
      if (next !== 'render') { clear(); first.reply.show({ root: r.host, ctx: r.ctx, mode: next }); return; }
      // A partner's different stay choice: an open Stay card would overwrite it, so it closes.
      const cards = first.cards;
      if (changed && cards && typeof cards.openKey === 'function' && cards.openKey() === 'stay') cards.close();
      r.paint();
    });
  }

  // Registered once, however many times the home screen is shown.
  function listen() {
    if (listening) return;
    listening = true;
    document.addEventListener('visibilitychange', () => { if (current && document.visibilityState === 'visible') refresh(); });
  }

  const api = { envelopes, dockItems, bigCount, nextLine, remindHref, afterRefresh, stayChanged, readFresh, home: { show, refresh, repaint, toast: toastHome, clear } };
  root.sjFirst = Object.assign(root.sjFirst || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
