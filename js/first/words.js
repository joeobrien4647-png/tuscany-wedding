// Every line here is a placeholder for Joe and Sophie to rewrite.
// Keep lines short and plain. Placeholders: {n}, {names}, {date}, {share}, and on the Getting there card {from}, {to},
// {drive}, {km}, {price}. No amounts or payment dates in this file.
(function (root) {
  'use strict';
  const SPRING = 'Send your share in the spring';

  const words = {
    cover: {
      kicker: 'Sophie & Joe',
      for: 'For',
      forBack: 'Welcome back',
      forNobody: 'You are invited',
      hint: 'Tap the seal',
      sealLabel: 'Open the invitation',
      foot: 'Tuscany, May 2027'
    },
    minute: {
      skip: 'Skip',
      soundOn: 'Sound is on',
      soundOff: 'Sound is off',
      title: 'Tuscany',
      dates: 'Friday 28 to Monday 31 May 2027',
      estateKicker: 'Four days at',
      estate: 'La Conca',
      weekendKicker: 'The weekend'
    },
    ask: {
      question: 'Are you coming?',
      yes: 'Yes!',
      no: 'Can’t make it',
      onlyOne: 'Only one of us can make it',
      who: 'Who is coming?',
      back: 'Back',
      replied: 'Your reply is in',
      change: 'Change my answer',
      saving: 'Saving your reply',
      closesNote: 'Replies close on {date}',
      watchAgain: 'Watch the invitation again'
    },
    yes: {
      title: 'See you in Tuscany',
      line: 'Your reply is saved'
    },
    no: {
      title: 'We’ll miss you',
      line: 'Changed your mind?',
      again: 'Reply again',
      until: 'You can change your answer until {date}'
    },
    closed: {
      line: 'Replies have closed',
      message: 'Please message Joe or Sophie'
    },
    nolink: {
      line: 'Please use the link Joe or Sophie sent you'
    },
    home: {
      kicker: 'Your trip',
      countdown: 'days to go',
      countdownOne: 'day to go',
      units: { h: 'h', m: 'm', s: 's' },
      nextIn: 'opens in {n} days',
      nextDay: 'opens in 1 day',
      nextSoon: 'opens in {n}',
      allOpen: 'Everything is open',
      opens: 'Opens {date}',
      soon: 'Nearly ready',
      today: 'Today',
      sealed: 'Sealed until {date}',
      open: 'Open',
      close: 'Close',
      back: 'Back to your trip',
      questions: 'Questions',
      watch: 'Watch the invitation again',
      notYou: 'Not you?',
      envelopes: {
        estate: { name: 'The estate' },
        room: { name: 'Your room' },
        menu: { name: 'The menu' },
        table: { name: 'Your table' },
        film: { name: 'The film' },
        photos: { name: 'The photos' }
      },
      photosStamp: 'June'
    },
    dock: {
      labels: ['Reply', 'Stay', 'Travel', 'Weekend'],
      stay: { plain: 'Stay', choose: 'Choose stay', villa: 'La Conca', own: 'Own place' },
      states: { plain: 'Ready to read', glow: 'Something to do', done: 'Done' },
      label: 'Plan your trip'
    },
    stay: {
      title: 'Where will you stay?',
      get: 'You get',
      need: 'You need to',
      recommended: 'Recommended',
      villa: {
        title: 'With us at La Conca',
        sub: 'All three nights, everything included',
        get: ['A bed at the estate for all three nights', 'Every breakfast, lunch and dinner'],
        need: [SPRING]
      },
      own: {
        title: 'I’ll book my own place',
        sub: 'Stay nearby, join the three gatherings',
        get: ['Friday evening, the wedding and Pool day & BBQ', 'Food and drinks at all three'],
        need: ['Sort your own breakfasts and other lunches', 'Nothing to pay us']
      },
      later: {
        title: 'Not sure yet',
        sub: 'Decide later, your reply is saved',
        get: ['Time to decide'],
        need: ['Come back and choose']
      },
      confirm: { villa: 'Stay at La Conca', own: 'Book my own place', later: 'Decide later' },
      share: 'Your share is {share}, the rest is on Joe and Sophie',
      spring: SPRING,
      word: 'Have a word with us if you need to',
      fixed: 'Your choice is fixed now, please message Joe or Sophie',
      saving: 'Saving your choice',
      sorted: 'All sorted'
    },
    replyCard: {
      coming: 'Coming',
      closed: 'To change your reply, please message Joe or Sophie'
    },
    // The Getting there card. Airports, airlines, drive times and tolls are not here: they come from the data file.
    travel: {
      title: 'Getting there',
      mapLabel: 'A map of your trip',
      back: 'Back',
      stampMark: 'Confirmed',
      view: { whole: 'Whole trip', close: 'Close up' },
      fields: { from: 'From', to: 'To', last: 'Last stretch', days: 'Days', choose: 'Choose' },
      summary: {
        empty: 'Build your trip',
        comparing: 'Comparing {n} airports',
        comparingOne: 'Flying from {from}',
        trip: '{from} to {to}',
        landing: 'Landing at {to}',
        italy: 'Already in Italy',
        road: 'Driving all the way',
        train: 'By train all the way'
      },
      from: {
        title: 'Where are you setting off from?',
        hint: 'Pick as many airports as you like',
        airports: 'UK airports',
        or: 'Or',
        each: 'Airport by airport',
        compare: 'Compare {n} routes',
        compareOne: 'See 1 route',
        groups: {
          london: 'London', northwest: 'North West', yorkshire: 'Yorkshire and North East', midlands: 'Midlands',
          scotland: 'Scotland', southwest: 'South West and Wales', ni: 'Northern Ireland'
        },
        kinds: { ABROAD: 'Outside the UK', ITALY: 'Already in Italy', ROAD: 'Driving all the way', TRAIN: 'Train all the way' }
      },
      route: {
        title: 'Pick a route',
        landing: 'Where are you landing?',
        again: 'See the routes again',
        sorts: { drive: 'Shortest drive', airport: 'By airport', price: 'Cheapest' },
        usually: 'Usually {names}',
        drive: '{drive} drive',
        check: 'Routes change, so check before you book',
        change: 'Flying with a change?',
        changeFrom: 'Leaving from',
        other: 'Landing somewhere else?',
        otherHint: 'Which airport?',
        otherDone: 'Use this airport',
        notFlying: 'Not flying',
        noDirect: 'No direct flights from here, try flying with a change'
      },
      last: {
        title: 'And the last stretch?',
        options: { hire: 'Hire car', lift: 'Getting a lift', taxi: 'Taxi', public: 'Public transport', own: 'Own car' },
        fact: 'By road: {drive}, {km} km',
        liftNote: 'Just so we know, lifts are yours to sort out'
      },
      days: {
        title: 'Which days?',
        arriving: 'Arriving',
        leaving: 'Leaving',
        span: '{from} to {to}',
        arrive: { early: 'Earlier', thu: 'Thu 27', fri: 'Fri 28', sat: 'Sat 29' },
        leave: { sun: 'Sun 30', mon: 'Mon 31', later: 'Staying on' }
      },
      done: {
        title: 'All set?',
        hint: 'Tap any box on the ticket to change it',
        stamp: 'Stamp my ticket',
        needReply: 'Reply first, then stamp',
        saving: 'Stamping your ticket',
        failed: 'Could not stamp it, please try again',
        retry: 'Try again'
      },
      stamped: {
        title: 'Ticket stamped',
        hint: 'Only Joe and Sophie can see your plan',
        change: 'Change something',
        another: 'Someone travelling separately?',
        who: 'Who is this ticket for?',
        next: 'Next',
        remove: 'Remove this ticket',
        ticket: 'Ticket {n}'
      },
      price: { from: 'from about {price}', checked: 'checked {date}', live: 'See live prices' },
      load: { wait: 'Unfolding the map', failed: 'Could not load the map', retry: 'Try again' }
    },
    // The Weekend screen: four days, each with a short intro, the parts of the day and a few lines. All placeholders.
    // A day's wear, bring, food and where are optional: a line that is not there is not shown.
    weekend: {
      title: 'The weekend',
      vibe: 'Drinks flowing all weekend',
      hint: 'Tap a day',
      swipe: 'Swipe for the next day',
      back: 'Back to the four days',
      open: 'Open the day',
      labels: { wear: 'Wear', food: 'Food and drink', where: 'Where' },
      days: [
        {
          date: 'Fri 28 May', name: 'Pizza night', intro: 'Bags down, drink in hand, pizza on the table',
          parts: [{ when: 'Afternoon', what: 'Arrive and settle in' }, { when: 'Evening', what: 'Pizza night' }],
          wear: 'Come as you are', food: 'Pizza'
        },
        {
          date: 'Sat 29 May', name: 'The wedding', intro: 'The big one: dressed up, outdoors and on late',
          parts: [{ when: 'Afternoon', what: 'The wedding' }, { when: 'Evening', what: 'A long evening outdoors' }],
          wear: 'Dressed up for a warm evening outdoors, ties optional, colour encouraged',
          bring: ['Shoes for gravel and grass', 'A layer for after dark']
        },
        {
          date: 'Sun 30 May', name: 'Pool day & BBQ', intro: 'A slow start, the pool all day, cold drinks and a BBQ',
          parts: [{ when: 'All day', what: 'Pool day and a BBQ' }],
          wear: 'Swimwear and BBQ clothes', food: 'A BBQ'
        },
        {
          date: 'Mon 31 May', name: 'Breakfast and goodbyes', intro: 'One more coffee together before the road home',
          parts: [{ when: 'Morning', what: 'One last breakfast together' }],
          food: 'Breakfast'
        }
      ]
    },
    // Each answer is a string or a short list of lines (at most three, at most 44 characters each).
    questions: {
      title: 'Questions',
      gifts: { q: 'Gifts?', a: 'Details will follow' },
      reach: { q: 'How do I reach you?', a: ['Message Joe or Sophie directly', 'The way you normally would'] },
      food: { q: 'Food needs?', a: ['Allergies or a diet we should know about?', 'Message Joe or Sophie'] },
      cost: {
        q: 'What does it cost?',
        a: ['At La Conca your share is {share}', 'That covers your bed, meals and drinks', 'Your own place: nothing to pay us']
      },
      weather: { q: 'Weather and packing?', a: ['Bring swimwear and a layer for the evening', 'More on the weather nearer the time'] },
      bring: { q: 'Can I bring someone?', a: ['Plus-ones are very limited', 'Please ask Joe or Sophie directly'] }
    },
    wait: {
      line: 'One moment'
    },
    errors: {
      save: 'Could not save, please try again',
      load: 'Could not load, please try again',
      retry: 'Try again'
    }
  };

  root.sjFirst = Object.assign(root.sjFirst || {}, { words });
  if (typeof module !== 'undefined' && module.exports) module.exports = { words };
})(typeof window !== 'undefined' ? window : globalThis);
