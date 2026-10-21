// Every word content puts on the page: places, notes and cards, each with its honesty status (fact, likely,
// approx, idea). Copy rules: no em dashes; no full stop on short standalone lines (kickers, titles, facts, where
// lines); fun and friendly, never sentimental. No room numbers, no beds per room, no guest names, nothing that
// names a ceremony spot or time, no play areas.

export const PHOTOS = {
  santarsaNight: { src: 'images/venue/saturday-night.jpg', alt: 'Villa Santarsa lit up at night' },
  santarsaPool: { src: 'images/venue/sunday-pool.jpg', alt: 'The pool at Villa Santarsa looking over the valley' },
  vallorsaiaPool: { src: 'images/venue/friday-pool.jpg', alt: 'The pool at Villa Vallorsaia in evening light' },
  above: { src: 'images/venue/hero-drone.jpg', alt: 'La Conca from above' },
};

export const ILLUSTRATIVE = 'An illustrative model built from La Conca’s published details and open map data, not an exact plan';

export const ESTATE = {
  kicker: 'Agriturismo La Conca',
  title: 'Two villas, one <em>hill</em>',
  text: 'Villa Santarsa and Villa Vallorsaia sit about 440 m apart on a wooded hillside above Sansepolcro, looking west across the Tiber valley. A pool each, woods all round, and the whole weekend is ours.',
  facts: ['Tap a villa to look inside, or search for a place'],
  photo: 'above',
  status: 'fact',
};

export const VILLAS = {
  santarsa: {
    kicker: 'Villa Santarsa',
    title: 'The stone <em>borgo</em>',
    text: 'A 16th-century stone hamlet in the upper part of the estate, about 800 m up: a long low wing, a tall block and a lower east end, all in a row. A big salone with a fireplace, a professional kitchen for feeding a crowd, and its own pool with a covered terrace, wood oven and two barbecues.',
    facts: ['13 bedrooms and 11 bathrooms, sleeps 31', 'Split into apartments, each with its own outside door'],
    photo: 'santarsaNight',
    status: 'fact',
  },
  vallorsaia: {
    kicker: 'Villa Vallorsaia',
    title: 'The old <em>farmhouse</em>',
    text: 'The oldest farmhouse on the estate, from before 1500: a knot of stone wings with roofs at different heights and an open loggia over the front. The old stable is now a hall that seats everyone, and the pool sits in the greenery above the house.',
    facts: ['10 bedrooms and 7 bathrooms, sleeps 26', 'Split into apartments, each with its own outside door'],
    photo: 'vallorsaiaPool',
    status: 'fact',
  },
};

export const VILLA_WHERE = 'Outline from OpenStreetMap. Storeys and room positions are illustrative: no floor plan is public';

// A bedroom tapped in a cut-open floor. Every bedroom gets the same card: the beds per room are not public.
export function bedroomCard(v) {
  const short = v.name.replace('Villa ', '');
  return {
    kicker: v.name,
    title: 'A <em>bedroom</em>',
    text: `One of ${short}’s ${v.bedrooms} bedrooms. We’ll sort out who sleeps where and tell you which villa you’re in nearer the time.`,
    facts: [`${v.bedrooms} bedrooms and ${v.bathrooms} bathrooms, sleeps ${v.sleeps}`, 'The beds in each room are still to be confirmed'],
    where: 'Every bedroom is drawn the same and none is numbered: where each one is, and its beds, are not public yet. The furniture shows how it could look',
    status: 'idea',
  };
}

export const TRAILS = {
  kicker: 'On foot', title: 'Two walks to <em>know</em>',
  text: 'Marked trails start at Santarsa: about 15 minutes to the tree house, and a longer climb to La Torretta, the park’s highest point, with a view all the way round. Their routes are not mapped yet, so they have no pins.',
  facts: ['The tree house, about 15 minutes on foot', 'La Torretta, the highest point, a view all the way round'],
  status: 'fact',
};

export const LIVING = { kicker: 'Inside', title: 'Living <em>space</em>', text: 'Apartment living rooms, bathrooms and stairs, in no particular order', status: 'approx' };

export const INTERIORS = {
  kicker: 'Inside',
  title: 'Furnished as an <em>idea</em>',
  text: 'Furnished in the style the listing photos show, as an idea of how it could look. The rooms are not where they really are.',
  facts: ['Every bedroom is drawn the same and none is numbered', 'Bathrooms are not drawn: which are en-suite is not published'],
  status: 'idea',
};

// Places with a viewpoint. `where` says how sure the model is about the spot; `status` is the tag the page shows.
export const PLACE_WORDS = [
  {
    id: 'sunset', short: 'Sunset view', villa: 'santarsa', status: 'fact', kicker: 'The view west', title: 'Where the sun <em>goes</em>',
    text: 'Both villas look west over the Tiber valley, and at the end of May the sun slides behind the Catenaia ridge at about 20:40, with golden hour from around 20:00. Friday night is pizza and drinks at sunset, so grab a glass and watch it go.',
    facts: ['Behind the ridge at about 20:39 on 29 May', 'Lake Montedoglio is about 6 km west, down in the valley'],
    where: 'Sun times worked out from terrain data, ignoring trees', moment: 'sunset',
    words: ['sunset', 'sun', 'view', 'lake', 'montedoglio', 'golden', 'hour', 'west', 'valley', 'evening'],
    pin: { minDist: 10, maxDist: Infinity },
  },
  {
    id: 'santarsa-pool', short: 'Pool', villa: 'santarsa', status: 'approx', kicker: 'Villa Santarsa · Pool', title: 'Fifteen metres of <em>blue</em>',
    text: 'A new 15 by 5.5 m pool right on the edge of the slope, with a shallow bay full of jets (probably at the east end), a long row of teal loungers, big square umbrellas and the whole valley beyond the railing. It lights up by itself at dusk.',
    facts: ['About 1.5 m deep, with a 2 m shallow end at 60 cm with jets and seats', 'The jet bay is probably at the east end, by the covered terrace', 'Fully fenced'],
    where: 'Size from La Conca. The spot is OpenStreetMap’s outline, which may still be the old pool, so it is approximate', photo: 'santarsaPool',
    words: ['pool', 'swim', 'swimming', 'jacuzzi', 'jets', 'tub', 'spa', 'whirlpool', 'hydromassage', 'loungers', 'sunbed', 'umbrella', 'santarsa'],
  },
  {
    id: 'santarsa-terrace', short: 'Covered terrace', villa: 'santarsa', status: 'likely', kicker: 'Villa Santarsa · Covered terrace', title: 'Wood fire and a <em>roof</em>',
    text: 'An open pavilion on rough stone piers under a low tiled roof, probably at the east end of the pool. Long tables down the middle, the wood oven built into the stone wall at the back, two stone barbecues, and the woods falling away beyond the parapet.',
    facts: ['Stone piers and a hipped tiled roof on dark timber trusses', 'The wood oven is built into its back wall', 'Two stone barbecues'],
    where: 'Approximate spot: probably the east end of the pool, read from the photos and OpenStreetMap, not yet confirmed by La Conca',
    words: ['pizza', 'oven', 'bbq', 'barbecue', 'barbecues', 'grill', 'terrace', 'tettoia', 'covered', 'outdoor', 'dining', 'santarsa'],
  },
  {
    id: 'santarsa-front', short: 'The front', villa: 'santarsa', status: 'likely', kicker: 'Villa Santarsa · The front', title: 'Flagstones, lawn and a <em>view</em>',
    text: 'A raised terrace of big irregular flagstones runs along the west wing, with wooden tables, folding chairs and a tall standing stone at its edge. Below it the lawn slopes down to the pool on a path of stepping stones, and pale gravel spreads in front of the tall block, with big rough sandstone blocks to perch on.',
    facts: ['A covered stone stair climbs to the tall block’s first floor', 'A round-arched doorway between two iron lanterns'],
    where: 'Seen in the photos; the size of each part is drawn by eye',
    words: ['front', 'lawn', 'garden', 'terrace', 'gravel', 'stair', 'stairs', 'steps', 'santarsa'],
  },
  {
    id: 'chapel', short: 'Chapel', villa: 'santarsa', status: 'likely', kicker: 'Villa Santarsa · The chapel', title: 'The chapel, <em>probably</em>',
    text: 'Santarsa’s small historic chapel belongs to the old hamlet: honey-coloured dressed stone, a two-leaf door under a half-round stone lunette, an iron lantern either side and an oak leaning over it all. The model puts it in the little stone building at the west end of the outbuildings by the pool, our best reading of the photos.',
    facts: ['Dressed stone, a moulded stone cornice, slit windows down the side', 'Inside, a single small nave under a pale timber truss'],
    where: 'Probably this building: same stone, slits and lanterns as the outbuildings by the pool. La Conca has not confirmed which one it is',
    words: ['chapel', 'church', 'nave'],
  },
  {
    id: 'vallorsaia-pool', short: 'Pool', villa: 'vallorsaia', status: 'fact', kicker: 'Villa Vallorsaia · Pool', title: 'The pool <em>above</em> the house',
    text: 'Twelve by six metres on sawn grey slabs, set in the lawn on the higher ground above the farmhouse, with the roofs and the lake below. Like its neighbour, it lights up by itself at dusk.',
    facts: ['About 1.5 m deep', 'Fully fenced'],
    where: 'Spot from OpenStreetMap, size from La Conca', photo: 'vallorsaiaPool',
    words: ['pool', 'swim', 'swimming', 'loungers', 'sunbed', 'vallorsaia'],
  },
  {
    id: 'vallorsaia-tettoia', short: 'Covered terrace', villa: 'vallorsaia', status: 'approx', kicker: 'Villa Vallorsaia · Covered terrace', title: 'Two fires, one <em>roof</em>',
    text: 'A 32 m² timber pavilion: square posts with knee braces, a tiled roof, small pendant lamps, a floor of big grey slabs and a stone back wall with two barbecue hearths side by side, lined with pale firebrick. Long tables and honey-coloured rush chairs for around twenty.',
    facts: ['Two built-in barbecue hearths', 'Seats about twenty at long tables'],
    where: 'Approximate spot: La Conca has not said where it stands, so it is drawn by the house',
    words: ['bbq', 'barbecue', 'barbecues', 'grill', 'terrace', 'tettoia', 'covered', 'outdoor', 'dining', 'vallorsaia'],
  },
  {
    id: 'vallorsaia-oven', short: 'Wood oven', villa: 'vallorsaia', status: 'approx', kicker: 'Villa Vallorsaia · Wood oven', title: 'The old wood <em>oven</em>',
    text: 'Vallorsaia has its original wood oven and a 32 m² covered terrace with two barbecues. La Conca has not said where they sit, so the model draws the oven as an old photo suggests, a half-round stone bump on the house wall by an outside stair, and the terrace on a likely spot by the house.',
    where: 'Drawn where it could be',
    words: ['pizza', 'oven', 'bbq', 'barbecue', 'grill', 'terrace', 'tettoia', 'covered', 'vallorsaia'],
  },
  {
    id: 'vallorsaia-lookout', short: 'Lookout', villa: 'vallorsaia', status: 'approx', kicker: 'Villa Vallorsaia · The lookout', title: 'The lake at your <em>feet</em>',
    text: 'On the downhill side of the clearing: rough stone piers, peeled timber rails on a low wall, picnic tables on a gravel terrace under big oaks, and Lake Montedoglio laid out below.',
    facts: ['Lake Montedoglio fills the view', 'Picnic tables under the oaks'],
    where: 'Approximate: the lookout is in the photos, its exact line is not mapped',
    words: ['lookout', 'view', 'lake', 'montedoglio', 'picnic', 'fence', 'vallorsaia'],
  },
  {
    id: 'santarsa-salone', short: 'Salone', villa: 'santarsa', room: 'santarsa-salone', status: 'likely', kicker: 'Villa Santarsa · Salone', title: 'One room, <em>everyone</em>',
    text: 'Open to two huge dark oak trusses, with pale stone walls, a blue-grey flagstone floor, a big stone fireplace under a thick timber beam, and long walnut tables with benches for the whole group. It opens straight into the professional kitchen.',
    facts: ['Tables and benches for the whole group', 'Opens into the group kitchen'],
    where: 'Probably the long single-storey west wing, open to its roof timbers; where exactly is not public',
    words: ['salone', 'lounge', 'living', 'fireplace', 'dining', 'dinner', 'hall', 'sitting', 'santarsa'],
  },
  {
    id: 'santarsa-kitchen', short: 'Kitchen', villa: 'santarsa', room: 'santarsa-kitchen', status: 'approx', kicker: 'Villa Santarsa · Kitchen', title: 'The <em>big</em> kitchen',
    text: 'A recently renovated professional kitchen built for groups of up to 30: six burners under a big steel hood, stainless worktops, a column fridge, a freezer and a professional dishwasher. It has its own door outside.',
    facts: ['Next to the salone'],
    where: 'Where exactly is not public: placed here to show what is in it',
    words: ['kitchen', 'cook', 'cooking', 'santarsa'],
  },
  {
    id: 'vallorsaia-stable', short: 'Old stable', villa: 'vallorsaia', room: 'vallorsaia-salone', status: 'approx', kicker: 'Villa Vallorsaia · The old stable', title: 'Under the stone <em>arch</em>',
    text: 'The farmhouse’s old stable, spanned by a big round stone arch and restored as a hall that seats the whole group at one very long plank table. There is a table football table too.',
    facts: ['Seats the whole group', 'Table football'],
    where: 'Part of the farmhouse, exact spot not public: placed here to show what is in it',
    words: ['stable', 'salone', 'hall', 'games', 'table', 'football', 'foosball', 'dining', 'dinner', 'lounge', 'vallorsaia'],
  },
  {
    id: 'vallorsaia-kitchen', short: 'Big kitchen', villa: 'vallorsaia', room: 'vallorsaia-big-kitchen', status: 'approx', kicker: 'Villa Vallorsaia · Big kitchen', title: 'The <em>long</em> table',
    text: 'One of the apartments has a big kitchen with a long table, a fireplace, a sofa and a TV. The photos show a timber gallery above it and a black cast-iron wood stove.',
    facts: [],
    where: 'Which apartment is not public: placed here to show what is in it',
    words: ['kitchen', 'cook', 'cooking', 'vallorsaia'],
  },
  {
    id: 'lane', short: 'The lane', villa: null, status: 'fact', kicker: 'Between the villas', title: 'A track through the <em>woods</em>',
    text: 'The villas are about 440 m apart as the crow flies, and the track between them winds a little further through the oaks. A short walk either way.',
    facts: ['About 440 m apart in a straight line, further by the track'],
    where: 'Track from OpenStreetMap',
    words: ['lane', 'track', 'between', 'walk', 'distance', 'far', 'path'],
    pin: { minDist: 10, maxDist: 420 },
  },
  {
    id: 'woods', short: 'Woods and trails', villa: 'santarsa', status: 'fact', kicker: 'The woods', title: 'Trails from the <em>door</em>',
    text: 'Marked trails start at Santarsa: about 15 minutes on foot to the tree house, and longer walks up to La Torretta, the park’s highest point, with a view all the way round. Deer graze behind Santarsa in the evening. Sunday has nothing before noon, so there is time.',
    facts: ['300 hectares of woods and meadows', 'Deer graze here in the evening'],
    where: 'Trails from La Conca; the woods from OpenStreetMap',
    words: ['woods', 'walk', 'walking', 'trail', 'trails', 'hike', 'tree', 'treehouse', 'forest', 'nature', 'deer', 'torretta'],
    pin: { minDist: 10, maxDist: 420 },
  },
  {
    id: 'road', short: 'The road up', villa: null, status: 'fact', kicker: 'Getting here', title: 'The road <em>up</em>',
    text: 'The last stretch: 4.2 km from the main road at Pocaia di Sopra, the final 2.4 km on the estate’s own white gravel road through the oak woods, past a row of tall cypresses near the start. Vehicles of up to 20 seats only, so no coaches.',
    facts: ['4.2 km from the main road, the last 2.4 km private', 'Vehicles up to 20 seats'],
    where: 'Road from OpenStreetMap; the cypresses are seen in a guest video near the start of the lane',
    words: ['road', 'drive', 'driving', 'car', 'arrive', 'arriving', 'arrival', 'directions', 'coach', 'minibus', 'taxi', 'cypress', 'cypresses', 'gravel'],
    pin: { minDist: 10, maxDist: 900 },
  },
  {
    id: 'santarsa-parking', short: 'Parking', villa: 'santarsa', status: 'approx', kicker: 'Villa Santarsa · Parking', title: 'Park on the <em>gravel</em>',
    text: 'Santarsa’s cars go on the gravel drive below the house, edged with big rough sandstone blocks. From there it is all on foot.',
    facts: ['Private parking at both villas'],
    where: 'Approximate spot: both villas have private parking, but the bays are not mapped',
    words: ['parking', 'park', 'car', 'cars', 'santarsa'],
    pin: { minDist: 10, maxDist: 500 },
  },
  {
    id: 'pond', short: 'Pond', villa: null, status: 'likely', kicker: 'On the trails', title: 'A pond in the <em>woods</em>',
    text: 'About 270 m west of Vallorsaia, OpenStreetMap shows a small pond in the woods, possibly the one on La Conca’s trails. Good for a quiet wander before the day gets going.',
    facts: ['About 270 m west of Vallorsaia'],
    where: 'Pond from OpenStreetMap; whether it is the trails’ pond is not confirmed',
    words: ['pond', 'water', 'trail', 'trails', 'walk', 'walking', 'wander'],
    pin: { minDist: 10, maxDist: 900 },
  },
];

// Things guests will search for that the model cannot show, or shows only roughly: an honest answer instead of a guess.
export const NOTE_WORDS = [
  { id: 'rooms', status: 'fact', title: 'Who sleeps where', sub: 'Comes later, from us', text: 'We’ll sort out who sleeps where and tell you which villa you’re in nearer the time. The beds in each room are still to be confirmed with La Conca, so the bedrooms in the model are drawn the same and not numbered.', villa: null, words: ['room', 'rooms', 'bedroom', 'bedrooms', 'bed', 'beds', 'sleep', 'sleeping', 'sleeps', 'allocation', 'allocations', 'double', 'single', 'twin', 'bunk', 'number', 'numbers', 'mine'] },
  { id: 'ceremony', status: 'fact', title: 'The ceremony', sub: 'The spot is not decided yet', text: 'The ceremony is on Saturday afternoon, outside in the grounds. The exact spot follows nearer the day, so the model does not mark one.', villa: null, words: ['ceremony', 'wedding', 'vows', 'aisle', 'altar', 'married', 'marry', 'marriage', 'service'] },
  { id: 'parking', status: 'approx', title: 'Parking', sub: 'Santarsa’s is drawn, Vallorsaia’s is not', text: 'Both villas have private parking. Santarsa’s is drawn roughly, on the gravel drive below the house; Vallorsaia’s spot is not mapped, so it is not in the model. The road up takes vehicles of up to 20 seats, so no coaches.', villa: null, words: ['parking', 'park', 'car', 'cars', 'drive', 'driving', 'minibus', 'coach', 'taxi'] },
  { id: 'chapel', status: 'likely', title: 'The chapel', sub: 'Probably the stone building by the pool', text: 'Santarsa has a small historic chapel that belongs to the old hamlet. The model shows it in the little stone building at the west end of the outbuildings by the pool, our best reading of the photos; La Conca has not confirmed which building it is.', villa: 'santarsa', words: ['chapel', 'church'] },
  { id: 'bathrooms', status: 'fact', title: 'Bathrooms', sub: 'Not published yet', text: 'Santarsa has 11 bathrooms and Vallorsaia 7. Which bedrooms are en-suite and which share is not published yet.', villa: null, words: ['bathroom', 'bathrooms', 'ensuite', 'en', 'suite', 'shower', 'toilet', 'loo', 'wc'] },
  { id: 'trails', status: 'fact', title: 'The trails', sub: 'Named, not mapped', text: 'La Conca’s 300 hectares have marked trails from Santarsa: about 15 minutes to the tree house, and longer walks up to La Torretta, the park’s highest point, with a view all the way round. Their routes are not mapped yet, so they have no pins.', villa: null, words: ['trail', 'trails', 'torretta', 'treehouse', 'hike', 'hiking', 'walks'] },
  { id: 'deer', status: 'fact', title: 'Deer at dusk', sub: 'Behind Santarsa in the evening', text: 'Fallow deer graze the grass behind Santarsa in the evening: La Conca says so, and has a photo of them. In the model they come out at golden hour and blue hour, at the edge of the woods. Not guaranteed.', villa: 'santarsa', words: ['deer', 'wildlife', 'animal', 'animals'] },
];

// ---------- the "how it could look" layer: ideas from weddings here, nothing decided ----------

// Joe's call (spec section 13, IDEAS_CARD in wedding.js, off): a card of standout ideas from weddings here. The
// list itself stays out of the public site so nothing Joe might plan as a surprise is in its source: it is in
// wedding-decor.md and v2-spec.md in the video repo, to copy in here if the card is ever switched on.
export const IDEAS = {
  kicker: 'How it could look', title: 'Ideas from weddings <em>here</em>',
  text: 'Other couples at La Conca have done all of these. Nothing here is decided.',
  facts: [],
  status: 'idea',
};

export const WEDDING_AT = 1268;   // blue hour on 29 May (sunset 20:43, blue hour over by about 21:17)

export const WEDDING_PLACE_WORDS = [
  {
    id: 'wedding-table', short: 'The long table', villa: 'santarsa', layer: 'wedding', status: 'idea', kicker: 'How it could look', title: 'The long <em>table</em>',
    text: 'One table the whole length of Santarsa’s pool deck, the valley on the other side of the railing: white linen, a garland of olive and eucalyptus running down the middle, candles in glass and wooden cross-back chairs. A past wedding at La Conca, probably at Santarsa, set a table like this.',
    facts: ['An idea from weddings here, not a plan'],
    words: ['table', 'dinner', 'dining', 'reception', 'long', 'candles'],
  },
  {
    id: 'wedding-lights', short: 'Under the lights', villa: 'santarsa', layer: 'wedding', status: 'idea', kicker: 'How it could look', title: 'Under the <em>lights</em>',
    text: 'Dozens of strands of warm bulbs under the tettoia’s beams, so the roof turns into a ceiling of light over a clear floor for dancing. More strands swoop from the house to tall curved poles over the deck.',
    facts: ['String lights seen at weddings here', 'Dancing right beside dinner'],
    words: ['lights', 'string', 'dance', 'dancing', 'party', 'music'],
  },
  {
    id: 'wedding-lawn', short: 'Drinks on the lawn', villa: 'santarsa', layer: 'wedding', status: 'idea', kicker: 'How it could look', title: 'Drinks on the <em>lawn</em>',
    text: 'White high tables on Santarsa’s front lawn and a rustic drinks counter, for the long golden hour before dinner. A gelato cart under the tettoia for later, and a blossom tree glowing by the cake.',
    facts: ['An idea from weddings here, not a plan'],
    words: ['drinks', 'aperitivo', 'cocktails', 'gelato', 'cake'],
  },
  {
    id: 'wedding-lookout', short: 'The lookout, dressed', villa: 'vallorsaia', layer: 'wedding', status: 'idea', kicker: 'How it could look', title: 'The lookout, <em>dressed</em>',
    text: 'At Vallorsaia, white birdcage lanterns on the lookout’s stone pillars and round paper lanterns in the big oak by the house, with the lake below.',
    facts: ['An idea from weddings here, not a plan'],
    words: ['lanterns', 'lookout', 'dressed', 'vallorsaia'],
  },
];

// The ceremony: never a set. Ideas for kinds of spot, from weddings at La Conca; a light vignette shows only while
// one's card is open. Off unless Joe says yes (spec section 13.1): CEREMONY_IDEAS in wedding.js, and then the
// ceremony note and Saturday's card need rewording, as both say the model marks nothing.
export const CEREMONY_PLACE_WORDS = [
  { id: 'ceremony-railing', short: 'Pool railing', villa: 'santarsa', title: 'By the pool <em>railing</em>', text: 'A past wedding at La Conca, probably at Santarsa, was set by a pool railing with the valley behind. Where and when ours happens is not decided yet.', where: 'An idea: one past wedding, probably at Santarsa, used a pool terrace like this' },
  { id: 'ceremony-lookout', short: 'Lookout', villa: 'vallorsaia', title: 'At the <em>lookout</em>', text: 'Vallorsaia’s lookout has the lake laid out below, and couples here have used it. Where and when ours happens is not decided yet.', where: 'An idea: the lookout is in the photos, its exact line is not mapped' },
  { id: 'ceremony-meadow', short: 'Meadow', villa: 'santarsa', title: 'In a <em>meadow</em>', text: 'Past weddings here used a field under a tree. This meadow below Santarsa stands in for one like it. Where and when ours happens is not decided yet.', where: 'An idea: a made-up spot, not one a wedding used' },
  { id: 'ceremony-glade', short: 'Oak glade', villa: null, title: 'In the <em>oak woods</em>', text: 'Past weddings here used glades in the oak woods. This one stands in for a glade like them. Where and when ours happens is not decided yet.', where: 'An idea: a made-up spot, not one a wedding used' },
  { id: 'ceremony-chapel', short: 'Chapel', villa: 'santarsa', title: 'At the <em>chapel</em>', text: 'Santarsa’s little chapel, probably this stone building. Past couples filled its aisle with white flowers. Where and when ours happens is not decided yet.', where: 'An idea: probably the chapel, which La Conca has not confirmed' },
].map((p) => ({ ...p, status: 'idea', layer: 'wedding', kicker: 'How it could look', facts: ['An idea, nothing is decided'], words: ['ceremony', 'spot', 'spots', 'aisle', 'chairs'], ceremony: true }));

// ---------- the weekend's moments (the rest: content/weekend.js); plan: what, when, where as d, l or t ----------
const PLAN_CODE = { d: 'decided', l: 'likely', t: 'tbd' };
const counted = {};
const moment = (id, when, title, caption, plan, words, extra = {}) => {
  const day = id.slice(0, 3);
  counted[day] = (counted[day] || 0) + 1;
  return { id, day, order: counted[day], when, title, caption, words: words.split(' '), ...extra,
    plan: { what: PLAN_CODE[plan[0]], when: PLAN_CODE[plan[1]], where: PLAN_CODE[plan[2]] } };
};
export const MOMENT_WORDS = [
  moment('fri-arrive', 'Whenever you land', 'Roll in to La <em>Conca</em>', 'Up through the oak woods to two villas, both ours for the weekend', 'ddd', 'arrive arrival land drive road'),
  moment('fri-settle', 'Whenever you land', 'Settle <em>in</em>', 'Find your room, find the pool, find everyone else', 'ddd', 'settle welcome'),
  moment('fri-pizza', 'As the sun goes down', 'Drinks and <em>pizza</em>', 'Wood-fired, nothing formal, sun going down behind the ridge', 'ddt', 'pizza drinks oven sunset'),
  moment('sat-ceremony', 'Afternoon', 'The <em>ceremony</em>', 'Outside, in the grounds', 'dtt', 'ceremony wedding vows married'),
  moment('sat-table', 'After the ceremony', 'A long Italian <em>lunch</em>', 'The kind that rolls on into dinner', 'dlt', 'lunch dinner table meal reception'),
  moment('sat-dancing', 'Into the night', '<em>Dancing</em>', 'Until the villa says stop', 'ddt', 'dancing dance party'),
  moment('sun-morning', 'Nothing before noon', 'Sleep it <em>off</em>', 'The morning is yours', 'ddd', 'morning sleep alarms'),
  moment('sun-pools', 'Noon onwards', 'The <em>pools</em>', 'Two pools, the valley, and nowhere to be', 'ddd', 'pool swim lunch food meals', { sub: 'What Sunday’s meals look like is still to be decided' }),
  moment('mon-breakfast', 'Morning', 'Breakfast and <em>goodbyes</em>', 'One last breakfast', 'ddt', 'breakfast goodbye goodbyes'),
  moment('mon-leave', 'Morning', 'Home <em>time</em>', 'Home, or stay on and see a bit more of Italy', 'ddd', 'home leave leaving stay'),
];
