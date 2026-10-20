/**
 * 3D glossy brand icons (assets/icons/*-v2.png) → semantic names.
 *
 * The raw files are named by what they depict (headphones.png, bolt.png, …);
 * screens should NEVER require() them by path. Import from here so every surface
 * uses the same picture for the same concept, and so swapping a picture only
 * touches one line.
 *
 * Render them with the <AppIcon> component (keeps sizing + resizeMode crisp).
 * The v2 sources share a 512×512 transparent canvas, lighting and optical
 * weight, so the same semantic icon stays crisp from compact stats to tiles.
 */
export const appIcons = {
  // Lesson skills (keys match Lesson.type + SKILL keys)
  listening: require('../../assets/icons/headphones-v2.png'),
  reading: require('../../assets/icons/book-open-v2.png'), // open green book
  fill: require('../../assets/icons/pencil-v2.png'),
  writing: require('../../assets/icons/notepad-pen-v2.png'),
  speaking: require('../../assets/icons/mic-v2.png'), // pink 3D microphone (Ярих)
  mic: require('../../assets/icons/mic-v2.png'),
  grammar: require('../../assets/icons/book-closed-v2.png'), // rulebook
  vocabulary: require('../../assets/icons/book-closed-v2.png'), // book of words

  // Gamification / currency
  xp: require('../../assets/icons/bolt-v2.png'), // lightning bolt (XP)
  sparks: require('../../assets/icons/diamond-blue-v2.png'), // Очирхон
  gem: require('../../assets/icons/diamond-gold-v2.png'),
  streak: require('../../assets/icons/flame-v2.png'), // orange flame drop
  heart: require('../../assets/icons/heart-v2.png'), // lives

  // Features / menu
  trophy: require('../../assets/icons/trophy-gold-v2.png'), // soril / rank
  trophyGreen: require('../../assets/icons/trophy-green-v2.png'),
  stats: require('../../assets/icons/bar-chart-v2.png'), // ахиц
  time: require('../../assets/icons/clock-v2.png'), // review / recent
  saved: require('../../assets/icons/bookmark-v2.png'),
  notifications: require('../../assets/icons/bell-v2.png'),
  home: require('../../assets/icons/home-v2.png'), // purple 3D house (home tab)
  gift: require('../../assets/icons/gift-v2.png'), // rewards
  profile: require('../../assets/icons/person-v2.png'),
  water: require('../../assets/icons/water-drop-v2.png'), // blue drop
} as const;

export type AppIconName = keyof typeof appIcons;
