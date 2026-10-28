/* Neutral demo copy. These phrases also supply the scene's Latin glyphs. */
export const BRAND = {name: 'Bridge', home: '#top'};
export const HERO = {
  eyebrow: 'An interactive motion demo',
  title: [{t: 'A journey through '}, {t: 'light', tone: 'warm'}, {t: ' and '}, {t: 'space', tone: 'cool'}],
  lead: 'Scroll to explore a sequence of words, particles and changing perspectives.',
  cue: 'Scroll to explore', skip: 'or skip'
};
export const PAIRS = [
  {q: 'Every journey begins with *a simple moment*, a quiet place and room to look around.',
   a: 'Follow *a line of light* as familiar shapes drift into a different perspective.'},
  {q: 'Between *near and far*, small details become part of a wider view.',
   a: 'Pause for a moment and *watch the scene unfold*, one layer at a time.'},
  {q: 'Let *warm and cool* colors meet across an open horizon.',
   a: '*A new view takes shape* as separate points come together in a single scene.'}
];
export const PAIR_LABELS = {pain: 'Perspective', solve: 'Reflection'};

export const CAPTIONS = [
  {side: 'l', range: [0.20, 0.325], kicker: '01 · Lorem ipsum', title: 'Lorem ipsum dolor sit amet',
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.', metric: {value: '24/7', label: ['lorem ipsum', 'dolor sit']}},
  {side: 'r', range: [0.325, 0.4], kicker: '02 · Consectetur', title: 'Consectetur adipiscing elit',
    text: 'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque.', facts: [['Lorem', 'Ipsum dolor'], ['Sit amet', 'Consectetur elit'], ['Tempor', 'Incididunt ut labore']]},
  {side: 'l', range: [0.4, 0.475], kicker: '03 · Tempor', title: 'Sed do eiusmod tempor',
    text: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo.', tags: ['lorem', 'ipsum', 'dolor', 'amet', 'elit']},
  {side: 'r', range: [0.475, 0.55], kicker: '04 · Labore', title: 'Ut labore et dolore magna',
    steps: ['Lorem ipsum dolor sit amet', 'Consectetur adipiscing elit', 'Sed do eiusmod tempor']},
  {side: 'l', range: [0.55, 0.625], kicker: '05 · Aliqua', title: 'Quis nostrud exercitation',
    text: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla.', bar: {value: 72, label: '72% · lorem ipsum dolor'}},
  {side: 'r', range: [0.625, 0.7], kicker: '06 · Commodo', title: 'Duis aute irure dolor',
    metric: {value: '×3', label: ['lorem ipsum', 'dolor sit amet']}, text: 'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.'},

];

export const HERO_FINAL = {
  eyebrow: 'The final view', title: 'A different perspective',
  lead: 'A short visual study in light, motion and space.',
  ctas: [{label: 'Explore the details', href: '#features'}, {label: 'About the demo', href: '#how', ghost: true}]
};
export const FILM = {label: 'Scene controls', play: 'Watch', pause: 'Pause', skip: 'Skip'};
export const SCENE_A11Y = 'An animated scene with optional quiet music. Words gather into light, particles form a city and a bridge, and the camera moves toward the final view. Sound can be muted beside the playback button.';
export const FEATURES = {
  eyebrow: 'A closer look', title: 'Light, form and motion',
  items: [
    ['Light', 'A warm glow meets a cool horizon.'],
    ['Form', 'Small points become a larger shape.'],
    ['Motion', 'Each view flows into the next.']
  ]
};
export const HOW = {
  eyebrow: 'About the demo', title: 'Take your time',
  steps: [
    ['Scroll', 'Move through the scene at your own pace.'],
    ['Watch', 'Play the sequence with optional sound.'],
    ['Explore', 'Use the markers to revisit a moment.']
  ]
};
export const CTA = {
  title: 'One more look', text: 'Return to the beginning and explore again.',
  link: {label: 'Back to the start', href: '#top'}
};
