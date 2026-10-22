# Getting there: sources

Every fact in `data/getting-there.json` carries one or more source keys. This file lists each key with its URL, the date it was checked and what it supports. Everything was checked on **Sun 4 Oct 2026** unless a line says otherwise.

How to read it:

- **Drive times** are estimates, shown to guests as rounded "about" times. `aboutMinutes` is the middle of three independent estimates (Google Maps, OSRM, Valhalla) rounded to the nearest 15 minutes, and `rangeMinutes` is the lowest and highest of the three. None of them include stops, roadworks or bank-holiday traffic.
- **Drives end at the gate**: where the public lane meets La Conca's private estate road (OSM node 2645891155, 43.59786 N 12.13069 E). The estate road to the villas is extra (see "The last stretch").
- **Flights** are the routes airlines and airports list in autumn 2026. Summer 2027 schedules aren't out yet, so the planner should say "usually" and "check before you book".
- **Transfers** are not booked. Nothing here promises one.

## Drive times and routes

| Airport | Shown as | Google Maps | OSRM | Valhalla | Route km (polyline) | Polyline from |
|---|---|---|---|---|---|---|
| PEG Perugia | about 1 hr | 49 min, 70.0 km | 65 min, 70.0 km | 66 min, 72.3 km | 70.0 | OSRM |
| FLR Florence | about 1 hr 45 min | 1 hr 37 min, 128 km | 1 hr 46 min, 127.7 km | 2 hr 10 min, 127.5 km | 127.7 | OSRM |
| BLQ Bologna | about 2 hr 15 min | 1 hr 52 min, 178 km | 2 hr 20 min, 178.8 km | 2 hr 15 min, 178.8 km | 178.8 | OSRM |
| PSA Pisa | about 2 hr 30 min | 2 hr 18 min, 195 km | 2 hr 34 min, 218.7 km (via A11) | 3 hr 4 min, 197.3 km | 197.3 | Valhalla |
| CIA Rome Ciampino | about 3 hr | 2 hr 34 min, 251 km | 3 hr 3 min, 264.1 km (via A1 to Arezzo) | 3 hr 5 min, 250.9 km | 250.9 | Valhalla |
| FCO Rome Fiumicino | about 3 hr 15 min | 2 hr 45 min, 269 km | 3 hr 15 min, 282.2 km (via A1 to Arezzo) | 3 hr 14 min, 268.9 km | 268.9 | Valhalla |

The polyline for each airport is the engine whose route matches the one Google Maps picked and, for Rome, Florence and Cesena, the way La Conca's own directions go. Each was simplified with Douglas-Peucker to at most 260 points (tolerance 5 to 47 m), stored as `[lat, lon]`.

La Conca's own 2022 page gives the same road distances: Florence 128 km, Bologna 178 km, Fiumicino 268 km, Pisa 195 km (`laconca-reach`). That matches the table to within 2 km.

- `osrm`: OSRM public demo server, car profile, `https://router.project-osrm.org/route/v1/driving/{lon},{lat};12.13069,43.5978622?overview=full&geometries=geojson&steps=true`. Six airport requests plus one for the estate (it won't route on the private road, so that part comes from OSM). Requests spaced over a second apart, with a descriptive User-Agent, per the demo server's usage policy. Checked 4 Oct 2026.
- `valhalla`: FOSSGIS Valhalla server, `https://valhalla1.openstreetmap.de/route`, auto costing, same start and end points. Six requests. Its per-manoeuvre `toll` flags (from OpenStreetMap tags) are the source for which stretches are tolled. Checked 4 Oct 2026.
- `gmaps`: Google Maps driving directions, "leave now" on Sun 4 Oct 2026 in the evening (light traffic), from each terminal point to 43.5978622, 12.13069 (Google names it "Fraz. Paradiso, 16, Sansepolcro"):
  - https://www.google.com/maps/dir/?api=1&origin=43.09502,12.50288&destination=43.5978622,12.13069&travelmode=driving (PEG: 49 min, 70.0 km, via SS3bis, no toll warning)
  - https://www.google.com/maps/dir/?api=1&origin=43.80231,11.20124&destination=43.5978622,12.13069&travelmode=driving (FLR: 1 hr 37 min, 128 km, via A1/E35, "This route has tolls")
  - https://www.google.com/maps/dir/?api=1&origin=44.52978,11.29298&destination=43.5978622,12.13069&travelmode=driving (BLQ: 1 hr 52 min, 178 km, via A14 and SS3bis, tolls)
  - https://www.google.com/maps/dir/?api=1&origin=43.69837,10.39939&destination=43.5978622,12.13069&travelmode=driving (PSA: 2 hr 18 min, 195 km, via SGC Firenze-Pisa-Livorno and A1/E35, tolls)
  - https://www.google.com/maps/dir/?api=1&origin=41.79946,12.59067&destination=43.5978622,12.13069&travelmode=driving (CIA: 2 hr 34 min, 251 km, via SS3bis, tolls)
  - https://www.google.com/maps/dir/?api=1&origin=41.79557,12.25033&destination=43.5978622,12.13069&travelmode=driving (FCO: 2 hr 45 min, 269 km, via SS3bis, tolls)
- `osm-airports`: OpenStreetMap aerodrome and terminal features, via the Overpass API, checked 4 Oct 2026. Route start points are the terminals: PEG way 196967561, FLR node 1988241468, BLQ relation 2127473, PSA way 22993409, FCO Terminal 3 way 33313146, CIA way 24210346 ("Aerostazione di Ciampino"). https://www.openstreetmap.org/way/196967561 (and so on for each id). Data © OpenStreetMap contributors, ODbL.

### Tolls

- `road-tolls`: which roads charge tolls.
  - A1 and A14 are tolled "closed system" motorways run by Autostrade per l'Italia: https://it.wikipedia.org/wiki/Autostrada_A1_(Italia) and https://it.wikipedia.org/wiki/Autostrada_A14_(Italia) (infobox "pedaggio: Sistema chiuso"), checked 4 Oct 2026.
  - The Rome ring road (A90, GRA) "has always been toll-free": https://en.wikipedia.org/wiki/Autostrada_A90, checked 4 Oct 2026.
  - The FI-PI-LI (Florence-Pisa-Livorno dual carriageway) has no tolls: https://it.wikipedia.org/wiki/Strada_di_grande_comunicazione_Firenze-Pisa-Livorno, citing the article "Pannelli sulla Fi-Pi-Li come in autostrada ma senza il pedaggio" (nove.firenze.it), checked 4 Oct 2026.
  - The E45 (SS3bis Tiberina, and SS675 from Orte to Terni) is a state road run by ANAS (https://it.wikipedia.org/wiki/Strada_statale_3_bis_Tiberina). Neither Valhalla nor OSM tags any toll on it, and Google Maps shows no toll warning for the Perugia route, which is E45 the whole way.
  - Tolled stretches per route, from Valhalla's toll flags: FLR and PSA, A1 Firenze to Arezzo, 71.9 km. BLQ, A14 Bologna to Cesena, 71.0 km. FCO and CIA, A1 Diramazione Roma Nord (22.2 km) plus A1 to Orte (40.1 km). Google Maps flags tolls on the same five routes and none on Perugia.

## Airports

Full names are the airports' own. Car hire lists are company names only (no prices), exactly as each airport lists them.

- `peg-car`: Aeroporto Internazionale dell'Umbria, "Noleggio auto", https://www.airport.umbria.it/passeggero/noleggio-auto/ , checked 4 Oct 2026. Desks "tra zona arrivi e zona check-in". Companies shown by logo and website: Hertz, Europcar, Avis, Budget, Sicily by Car, Autovia, Sixt, Noleggiare.
- `peg-dest`: Perugia "Mappa destinazioni", https://www.airport.umbria.it/passeggero/voli/mappa-destinazioni/ , checked 4 Oct 2026. Summer 2026 (29 Mar to 24 Oct): "LONDRA STANSTED - Ryanair", "LONDRA HEATHROW - British Airways". Winter 2025-26 lists Stansted only.
- `peg-transport`: Perugia "Trasporti", https://www.airport.umbria.it/passeggero/trasporti/ , checked 4 Oct 2026. Perugia Airlink (Trenitalia and Busitalia) buses link Perugia and Assisi stations with the airport in about 20 minutes.
- `fcu-works`: the old Umbrian railway (ex FCU) north from Città di Castello to Sansepolcro is still being rebuilt. Track laying on that section is scheduled 7 Nov 2026 to 14 Jan 2027, with the line from Terni to Città di Castello hoped for by Sept 2027 and a later schedule running to Oct 2028: https://www.ttv.it/infrastrutture/citta-di-castello-sansepolcro-ecco-il-cronoprogramma-dei-lavori-sulla-fcu and https://www.corrierediarezzo.it/news/attualita/403397/ferrovie-da-aprile-i-lavori-alla-ex-fcu-sul-collegamento-sansepolcro-citta-di-castello-il-punto-della-situazione.html (as summarised by web search, 4 Oct 2026). So don't count on it in May 2027.
- `flr-car`: Florence Airport "Car rentals", https://www.aeroporto.firenze.it/en/component/content/article/1055-rent-a-car.html?Itemid=569 . The site didn't load from here on 4 Oct 2026, so this is the Wayback Machine copy of 18 May 2026: https://web.archive.org/web/20260518005042/https://www.aeroporto.firenze.it/en/component/content/article/1055-rent-a-car.html?Itemid=569 . "Car Rentals are located at 'Palagio degli Spini', connected to the airport by a free shuttle bus that runs every 20 minutes. The shuttle bus stops is inside the short term car park, just outside the terminal." Companies: Autovia, Avis-Budget, Drivalia, Europcar, Hertz, Locauto / Enterprise / National / Alamo, Maggiore / National, Noleggiare, Sicily by Car, Sixt, SRC Rent Car.
- `flr-tram`: Florence Airport "Tramway", Wayback copy of 22 Jan 2025: https://web.archive.org/web/20250122082445/https://www.aeroporto.firenze.it/en/the-passengers/transport/tramway.html . Tram T2, airport to Piazza dell'Unità Italiana, "Transit time: 20 minutes".
- `blq-car`: Bologna Airport "Rent a car", https://www.bologna-airport.it/en/from-and-to-the-airport/car-and-private-transport/car-rental/?idC=62441 , checked 4 Oct 2026. "Car rental companies are located at the Terminal on the ground floor." Cars on "Level 0 of P3 Comfort". Companies: Autovia; Avis, Budget, Maggiore; Drivalia; Europcar; Hertz, Dollar, Thrifty; Italy Car Rent; Locauto Rent, Enterprise, National, Alamo; Noleggiare; Sicily by car; Sixt Rent a Car.
- `blq-london`, `blq-manchester`, `blq-edinburgh`: Bologna Airport destination pages, checked 4 Oct 2026. London: Heathrow (British Airways), Luton (Ryanair), Stansted (Ryanair): https://www.bologna-airport.it/en/flights/departing-from-bologna/direct-flights-from-bologna/london/?idC=61735&idO=34652 . Manchester (Ryanair, Ryanair UK): https://www.bologna-airport.it/en/flights/departing-from-bologna/direct-flights-from-bologna/manchester/?idC=61735&idO=167193 . Edinburgh (Ryanair): https://www.bologna-airport.it/en/flights/departing-from-bologna/direct-flights-from-bologna/edinburgh/?idC=61735&idO=34703 . The airport's airline list has no easyJet or Jet2.
- `blq-train`: Bologna Airport "Train to the city centre", https://www.bologna-airport.it/en/from-and-to-the-airport/transfer-from-and-to-the-airport/train-to-the-city-centre/?idC=62594 , checked 4 Oct 2026. Marconi Express monorail to Bologna Centrale, "7-minute rides".
- `psa-car`: Pisa Airport "Car rentals". The site didn't load from here on 4 Oct 2026, so this is the Wayback copy of 11 Jun 2026: https://web.archive.org/web/20260611222440/https://pisa-airport.com/en/component/content/article/1055-rent-a-car.html?Itemid=569 . "The Car Hire Terminal is only 500 meters from the Passenger Terminal. It is easy to reach on foot (5 minutes ca.)." Companies: AutoOne, Autovia, Avis, Budget, Drivalia, Easy Car Hire, Europcar, Goldcar, Hertz, Italy Car Rent, Liberty Rentals, Locauto / Enterprise / National / Alamo, Maggiore, Noleggiare, Ok Mobility, Rental Plus, Sicily by Car, Sixt, SRC Rent Car.
- `psa-mover`: Pisa Airport "People Mover", Wayback copy of 16 Jul 2025: https://web.archive.org/web/20250716112457/https://www.pisa-airport.com/en/the-passengers/transport/people-mover.html . The People Mover stop is "less than 40 metres from the Passenger Terminal", direct to Pisa Centrale, daily 06:00 to 00:00.
- `psa-airlines`: Pisa Airport airline list (British Airways, easyJet, jet2.com, Ryanair and others), Wayback copy of 15 Jun 2025: https://web.archive.org/web/20250615053510/https://www.pisa-airport.com/en/the-passengers/departures/airlines.html
- `fco-car`: ADR, Fiumicino "Car rental", https://www.adr.it/web/aeroporti-di-roma-en/pax-fco-car-rental , checked 4 Oct 2026. Desks "located in Office Tower 2", reached by pedestrian tunnels; cars picked up and returned in Multilevel Parking buildings A, B or C. Companies: Autovia, Avis-Budget, Differental / Autounion, Drivalia, Europcar, Goldcar, Hertz-Thrifty-Dollar, Italy Car Rent, Locauto Enterprise - National - Alamo, Maggiore, Noleggiare, OK Mobility, Rent4u, Sicily by Car, Sixt, Viaggiare Rent.
- `fco-train`: ADR, Fiumicino "Train", https://www.adr.it/web/aeroporti-di-roma-en/pax-fco-train , checked 4 Oct 2026. Leonardo Express to Roma Termini: "32 minutes, with departures every 15 minutes".
- `cia-car`: ADR, Ciampino "Car rental", https://www.adr.it/web/aeroporti-di-roma-en/pax-cia-car-rental , checked 4 Oct 2026. Desks "at the entrance of the airport (Via Mameli) inside P6, P8 and P12 parking areas", with a "complimentary shuttle service" to the terminal. Companies: Autovia, Avis - Budget, Drivalia, Europcar, Hertz - Thrifty - Dollar, Locauto Rent - Enterprise - National - Alamo, Sicily by Car - Auto Europa, Sixt.
- `cia-train`: ADR, Ciampino "Train", Wayback copy of 14 Jun 2026: https://web.archive.org/web/20260614094116/https://www.adr.it/web/aeroporti-di-roma-en/pax-cia-train . Ciampino Airlink bus every 20 minutes to Ciampino station, for trains to Termini.

### Is Ciampino worth listing?

Yes. Ryanair's Rome flights from Stansted, East Midlands and Liverpool go to Ciampino, not Fiumicino (`ryanair-map`). The drive is about the same as from Fiumicino, slightly shorter (250 km against 270 km), and car hire is on site (`cia-car`).

## Flights from the UK (usually)

These are the routes listed in autumn 2026. Summer 2027 timetables aren't published yet, so they are "usually" routes: check before booking.

- `ryanair-map`: Ryanair's route map data, the feed behind https://www.ryanair.com/gb/en/useful-info/route-map , read from `https://www.ryanair.com/api/views/locate/searchWidget/routes/en/airport/{IATA}` for PEG, BLQ, PSA, FCO, CIA and FLR on 4 Oct 2026. UK airports per Italian airport: PEG Stansted. BLQ Edinburgh, Luton, Manchester, Stansted. PSA Birmingham, Edinburgh, Manchester, Glasgow Prestwick, Stansted. FCO Birmingham, Cardiff, Edinburgh, Manchester. CIA Edinburgh, East Midlands, Liverpool, Manchester, Stansted. FLR: Ryanair doesn't fly there.
- `ryanair-new`: the same Ryanair feed, re-read on 4 Oct 2026, marks four of those UK routes `"recent": true` (new on its route map): Birmingham, Cardiff and Edinburgh to Fiumicino, and Glasgow Prestwick to Pisa. Every other UK route to the six airports is `"recent": false`. A brand-new route may not be running in May 2027, so the planner lists these as "New" with a check-it-runs note, and the "Flying from" note says so for Cardiff and Prestwick, where it is the only route.
- `ba-peg-2027`: British Airways London Heathrow to Perugia over the wedding weekend, checked on the airline's own site on 24 Sep 2026 for the travel page's flight search (`travel.html`, its Perugia card and the comment above its flight-search script): it flies on Thu 27 May 2027 but not on Fri 28 or Mon 31 May, so the search leaves it out. Not re-checked on 4 Oct 2026 (ba.com was queueing).
- `easyjet-pisa`: easyJet "Cheap flights to Pisa", https://www.easyjet.com/en/cheap-flights/italy/pisa , checked 4 Oct 2026: Bristol, Glasgow, London Gatwick, London Luton, London Southend and Manchester to Pisa. easyJet's Florence page (https://www.easyjet.com/en/cheap-flights/italy/florence) sends Florence travellers to Pisa: easyJet doesn't fly to Florence.
- `easyjet-rome`: easyJet "Cheap flights to Rome", https://www.easyjet.com/en/cheap-flights/italy/rome , checked 4 Oct 2026: Belfast International, Birmingham, Bristol, Edinburgh, Glasgow, London Gatwick, Manchester and Newcastle to Rome Fiumicino.
- `jet2-pisa`: Jet2 "Cheap Flights to Pisa", https://www.jet2.com/en/flights/italy/pisa , checked 4 Oct 2026: Birmingham, Leeds Bradford, Manchester.
- `jet2-rome`: Jet2 "Cheap Flights to Rome (FCO)", https://www.jet2.com/en/flights/italy/rome , checked 4 Oct 2026: Birmingham, Edinburgh, Glasgow, Leeds Bradford, London Stansted, Manchester, Newcastle.
- `lcy-dest`: London City Airport destinations, https://www.londoncityairport.com/flight-info/destinations , checked 4 Oct 2026: Florence, "When we fly: All year", British Airways.
- `lhr-flights`: Heathrow's own flight pages, as indexed by web search on 4 Oct 2026 (the pages load live data and didn't return it to a plain fetch): BA520 and BA522 to Florence (https://www.heathrow.com/departures/terminal-2/flight-details/BA520), BA614 and BA616 to Pisa (https://www.heathrow.com/departures/terminal-5/flight-details/BA614), BA548, BA556, BA560 and BA562 to Rome Fiumicino (https://www.heathrow.com/departures/terminal-5/flight-details/BA548).
- `ba-flr-2022`: British Airways media centre, 29 Dec 2022, "British Airways announces new daily flight from London Heathrow to Florence" (from 16 Apr 2023, alongside the existing London City flights): https://mediacentre.britishairways.com/news/29122022/british-airways-announces-new-daily-flight-from-london-heathrow-to-florence . ba.com's own destination pages were queueing ("high demand") on 4 Oct 2026.
- `stn-ba-2024`: London Stansted media centre, 20 May 2024, "Flights to popular European hotspots begin with BA": BA CityFlyer to Florence on Saturdays and Sundays in season. https://mediacentre.stanstedairport.com/flights-to-popular-european-hotspots-begin-with-ba/ . Not confirmed for 2026 or 2027, so it sits under `alsoReported`.
- `vueling-lon-flr`: Vueling "Cheap flights London to Florence", https://www.vueling.com/en-gb/flights-from-london-to-florence , checked 4 Oct 2026: "Departing from London Gatwick (LGW) ... you'll arrive at Florence Airport (FLR)", with fares shown for Oct and Nov 2026.
- `ita-lhr-fco`: ITA Airways "Flight from London to Rome", https://www.ita-airways.com/en_gb/offers/london-heathrow-rome.html (redirects to https://www.ita-airways.com/lhg/gb/en/o-d/cy-cy/london-rome), checked 4 Oct 2026: London Heathrow (LHR) to Rome Fiumicino.
- `wizz-ltn-fco`: Wizz Air "Cheap Flights From London to Rome", https://www.wizzair.com/en-gb/cheap-flights-from-london-to-rome , checked 4 Oct 2026: daily LTN to FCO fares listed for Oct and Nov 2026.

Cross-check: the English Wikipedia "Airlines and destinations" tables for the six airports (read through the Wikipedia API on 4 Oct 2026) agree with the airline and airport sources above, with these exceptions, where the airline's own page wins: easyJet Edinburgh to Fiumicino, Jet2 Leeds Bradford and Newcastle to Fiumicino, and Ryanair Cardiff, Edinburgh and Manchester to Fiumicino are on the airlines' pages but not in Wikipedia. Wikipedia also lists British Airways Stansted to Florence, which supports `stn-ba-2024` but isn't proof it runs in 2027.

## Public transport

- `laconca-reach` (below) says: "Take the train to Arezzo, and then the bus to Sansepolcro. The service is fairly frequent."
- `at-si381`: Autolinee Toscane line SI381 Arezzo - Anghiari - Sansepolcro - Città di Castello, https://www.at-bus.it/it/linee-e-orari/arezzo-extraurbano-si381 , checked 4 Oct 2026 (the winter timetable PDF is linked from that page; summer 2027 times aren't out).
- From Sansepolcro town centre (43.5701 N, 12.1404 E, `nominatim`) La Conca's GPS point is about 3.7 km away as the crow flies and further by road, all uphill at the end. La Conca's 2022 page listed a Sansepolcro taxi service for guests arriving by train or plane; ask La Conca for current numbers rather than relying on that list.
- A taxi straight from Arezzo: OSRM measures 48.6 km from the A1 Arezzo exit to the gate (`osrm`, FLR route), so "roughly 45 km" from the town.
- Train times between Florence, Rome or Bologna and Arezzo vary a lot by service, so the planner sends guests to trenitalia.com rather than quoting a time.
- `sulga-lines`: Sulga "Linee e orari", https://www.sulga.it/linee/linee-e-orari/ , checked 4 Oct 2026. Lists the line "Ravenna – Forlì – Cesena – Sansepolcro - Città di Castello – Perugia – Roma – Fiumicino" (both ways), with timetables and fares as PDFs, and a news item moving its Fiumicino airport departure bay from 22 Jan 2026. Other sites (Rome2rio, an orariautobus.it timetable, as found by the review on 4 Oct 2026) put the coach at about 4 hr 40 to 5 hr from Fiumicino to Sansepolcro, Monday to Saturday, booked ahead; the planner quotes none of that and sends guests to sulga.it.
- `fcu-buses`: Busitalia has run replacement buses on the Sansepolcro - Perugia - Terni line while the railway is shut (Umbria24, "Chiusura Fcu, da martedì a mezzanotte stop ai treni: gli orari dei bus sostitutivi", https://www.umbria24.it/attualita/chiusura-fcu-martedi-mezzanotte-stop-ai-treni-gli-orari-dei-bus-sostitutivi-lavoratori-assemblea/ , found by web search on 4 Oct 2026). We couldn't find a current timetable on fsbusitalia.it, so the planner says "has run" and gives no times.
- Perugia by public transport is possible but fiddly: Airlink into Perugia, then Sulga's coach or a Busitalia bus to Sansepolcro (`peg-transport`, `fcu-works`, `sulga-lines`, `fcu-buses`). Earlier versions of the planner said there was no practical public transport, which the sources don't support.
- Every public transport note ends "A long day with bags, so sharing a hire car is much easier." The small print says once that no transfers are booked.

## The last stretch

- `laconca-reach`: La Conca "How to reach us", http://www.laconca.it/en/location/ , Wayback copy of 16 Jan 2022: https://web.archive.org/web/20220116105108/http://www.laconca.it/en/location/ . Quotes:
  - "In the GPS set ONLY the coordinates". "GPS Coordinates : Lat. North 43°36'08.1", Long. Est 12°07'44.1"" (that's 43.602250 N, 12.128917 E).
  - From Rome: "Take the A1 Highway (Autostrada) to Orte; From Orte take highway E45 towards Cesena and exit at Sansepolcro; From the exit follow the signs for Rimini through two roundabouts; After the second roundabout keep going towards Rimini for about 600metres (656 yards); On the right you will see a sign for the turning to La Conca; The road is three kilometres (1.86 miles) long, and ends in the park".
  - From Cesena: "Take the E45 towards Rome; Exit at Sansepolcro North" then the same Rimini road. From Florence/Arezzo: "A1 highway until Arezzo ... follow the signs for Sansepolcro".
- Wording: because the newest full text of La Conca's directions and villa pages is from 2022, the planner says so wherever it leans on them: the satnav advice ("La Conca's own directions (the 2022 version, the newest we could read)"), parking and wifi ("La Conca's villa pages list ...") and the estate road ("may be unmade in places", from one guest review; OpenStreetMap tags no surface on the private ways). Ask La Conca to confirm all three before launch.
- `laconca-contact`: La Conca "Contact", https://laconca.it/en/contact/ . It didn't load from here on 4 Oct 2026 (connection refused), but web search's copy of the page on 4 Oct 2026 carries the same directions, and the Italian contact page (Wayback, 18 Jan 2025: https://web.archive.org/web/20250118112104/https://laconca.it/contatti/) gives the address "Via dei Sassi Rossi, 101 52037 Sansepolcro (AR)". **Check the live page before launch**: the 2022 directions are the newest full text we could read.
- `laconca-santarsa`: La Conca "Villa Santarsa", Wayback copy of 18 Aug 2022: https://web.archive.org/web/20220818171149/https://www.laconca.it/en/house-santarsa/ . "in the high part of the property, at about 800 metres (2624 feet) above sea level", "a big and beautiful covered terrace with tables where you can enjoy the sunset", "Free WI FI is available in all the rooms of the house, free parking available".
- `laconca-vallorsaia`: La Conca "Villa Vallorsaia", Wayback copy of 18 Aug 2022: https://web.archive.org/web/20220818162508/https://www.laconca.it/en/house-vallorsaia/ . "in the wildest part of the property, at about 800 metres (2624 feet) a.s.l. with a wonderful view over montedoglio lake", "a natural terrace with tables to enjoy the fantastic view and sunsets", "Free WI FI is available in all the rooms of the house, free parking available". A guest review quoted on the page: "It is a little bit of a hike through the dirt road to get there but it is totally worth it."
- `osm-estate`: OpenStreetMap ways, read from the OSM API on 4 Oct 2026 (© OpenStreetMap contributors, ODbL):
  - way 156335215 "Località paradiso": asphalt, `lanes=1`, `maxspeed=40`, 402 m (the start of the lane after the turn-off). https://www.openstreetmap.org/way/156335215
  - way 185812647 "Località paradiso": `surface=gravel`, 401 m. https://www.openstreetmap.org/way/185812647
  - ways 259236739, 259236748 ("Via dei Sassi Rossi"), 1017592179, 1017592180 and 259236750: asphalt lane up to the gate.
  - way 259236754: `highway=service`, `access=private`, 647 m from the gate (node 2645891155) to the La Conca building (way 330222370, at La Conca's GPS point). https://www.openstreetmap.org/way/259236754
  - way 261119415: `access=private`, `ref=Agriturismo La Conca`, 1,713 m from the La Conca building up to just below Villa Santarsa. https://www.openstreetmap.org/way/261119415
  - way 261119529: `access=private`, 439 m, the branch up to Villa Vallorsaia. https://www.openstreetmap.org/way/261119529
  - Lengths: turn-off to gate about 1.86 km (OSRM). Gate to La Conca building 0.65 km, to Santarsa 2.36 km, to Vallorsaia 2.73 km (sums of the OSM way geometry). No surface is tagged on the private ways.
- `osm-villas`: OpenStreetMap "Santarsa" (way 261118783, https://www.openstreetmap.org/way/261118783) and "Vallorsaia" (way 261118532, https://www.openstreetmap.org/way/261118532, tagged `ele=796`).
- `elev`: EU-DEM 25 m elevations from the OpenTopoData public API (https://api.opentopodata.org/v1/eudem25m), 4 Oct 2026: turn-off 350 m, start of the gravel 367 m, gate 521 m, La Conca building 565 m, Villa Santarsa 807 m, Villa Vallorsaia 790 m, Sansepolcro centre 333 m.
- `road-limit`: the road up to La Conca takes vehicles of up to 20 seats only, so no coaches. This is what the local transfer firms quoting for the weekend told Joe and Sophie by email in Sept and Oct 2026 (private correspondence, not published). Nobody has booked transfers.
- Phone signal: we found no reliable source for mobile coverage at the villas, so the planner says it's unknown and suggests offline maps.
- `osrm` also supplies the turn-off point (43.585167 N, 12.125449 E): the "turn slight right onto Località paradiso" step, 518 m after the second roundabout, which matches La Conca's "about 600 metres".

## Sunset on Friday 28 May 2027

- `noaa-calc`: our own calculation with the NOAA solar position equations, for Villa Santarsa (43.6054 N, 12.1429 E), CEST (UTC+2), flat horizon: sunrise 05:35, sun 6° up (start of golden hour) 19:59:38, sunset 20:42:19 (sun's upper edge at -0.833°), end of civil twilight 21:16:58. Sansepolcro centre comes out within a few seconds of the same times.
- `tad`: timeanddate.com, "Sunrise and sunset times in 43°36'19"N, 12°08'34"E, May 2027", https://www.timeanddate.com/sun/@43.6054,12.1429?month=5&year=2027 , checked 4 Oct 2026. Row for 28 May: sunrise 05:35, sunset 20:42, civil twilight ends 21:16.
- Time zones: Italy and the UK both move their clocks forward on Sun 28 Mar 2027 and back on Sun 31 Oct 2027, so on the wedding weekend Italy (CEST, UTC+2) is one hour ahead of the UK (BST, UTC+1): https://www.timeanddate.com/time/change/italy/rome?year=2027 and https://www.timeanddate.com/time/change/uk/london?year=2027 , checked 4 Oct 2026 (also under `tad`).
- The planner shows sunset 20:42, golden hour from about 20:00 and last light about 21:17 (the `noaa-calc` figure rounded to the minute; timeanddate rounds it down to 21:16). Hills on the western skyline can hide the sun a few minutes before the flat-horizon time.
- `noaa-calc` again, same method and place, rounded to the minute, for guests who arrive on another day (`friday.weekSun` in the JSON): sunset 20:40 on Wed 26, 20:41 Thu 27, 20:42 Fri 28, 20:43 Sat 29, 20:44 Sun 30 and 20:45 Mon 31 May; last light 21:15 to 21:20 over the same days. Calculated 4 Oct 2026.
- The planner's allowance from landing to driving away (`plannerDefaults`) is about 45 minutes for passport control, bags and the car hire desk. It is a guess, not a measured figure, so guests can switch it to 30, 60 or 90 minutes. The first entry under the EU's new passport checks (EES) can take longer.

## Map

- `naturalearth`: Natural Earth 1:10m Admin 0 Countries (public domain, https://www.naturalearthdata.com/about/terms-of-use/), read from the world-atlas `countries-10m.json` that the welcome film uses (tuscany-welcome-video/node_modules/world-atlas). Cropped to 6.0 to 16.5 E, 39.5 to 47.0 N, simplified at 0.006° and rounded to 3 decimals: `data/getting-there-map.json`. Use the film's projection, `d3.geoConicConformal().parallels([42, 45]).rotate([-11.6, 0])`, so the planner matches the film.
- `nominatim`: town label points (Sansepolcro, Arezzo, Perugia, Firenze, Roma, Bologna, Pisa, Anghiari, Città di Castello) from OpenStreetMap Nominatim, 4 Oct 2026, one request per town. © OpenStreetMap contributors, ODbL.

## Differences from the current travel page

`travel.html` (written before this research) gave some different drive times. These numbers replaced them, in its airport cards and in its flight search results alike:

| Airport | travel.html | This research |
|---|---|---|
| Perugia | about 1 hr 10 min | about 1 hr |
| Florence | about 1 hr 45 min | about 1 hr 45 min |
| Bologna | about 2 hr 20 min | about 2 hr 15 min |
| Pisa | about 2 hr 50 min | about 2 hr 30 min |
| Rome Ciampino | about 3 hr 5 min | about 3 hr |
| Rome Fiumicino | about 3 hr 40 min | about 3 hr 15 min |

Rimini and Ancona appear on `travel.html` and the arrivals board but aren't in the planner. Their drive times were measured the same way on 5 Oct 2026, from the terminal in OpenStreetMap to the same gate point, and shown as the middle of the three rounded to the nearest 15 minutes:

| Airport | Shown as | Google Maps | OSRM | Valhalla |
| --- | --- | --- | --- | --- |
| RMI Rimini (terminal way 223807954, 44.02265, 12.61922) | about 1 hr 45 min | 1 hr 34 min, 133 km, via SS3bis (tolls) | 1 hr 43 min, 96.9 km | 1 hr 55 min, 133.6 km |
| AOI Ancona (terminal way 69260001, 43.60884, 13.35756) | about 2 hr 15 min | 1 hr 50 min, 173 km, via SS76 and SS3bis | 2 hr 15 min, 153.5 km | 2 hr 20 min, 173.8 km |

Google Maps was read "leave now" on Mon 5 Oct 2026 in the afternoon ("the usual traffic"), not on the Sunday evening of the other six. The old figures on `travel.html` (Rimini about 2 hrs, Ancona about 2 hrs 20 min) were 15 and 5 minutes higher. Rimini's and Ancona's flights weren't part of this research.
