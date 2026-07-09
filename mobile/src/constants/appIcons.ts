/**
 * 3D glossy brand icons (assets/icons/*.png) → semantic names.
 *
 * The raw files are named by what they depict (headphones.png, bolt.png, …);
 * screens should NEVER require() them by path. Import from here so every surface
 * uses the same picture for the same concept, and so swapping a picture only
 * touches one line.
 *
 * Render them with the <AppIcon> component (keeps sizing + resizeMode crisp).
 * NOTE: the source PNGs are low-resolution (≈140–290px). Render small (≤~40pt)
 * so they stay sharp; re-export at 512px+ before using them larger.
 */
export const appIcons = {
  // Lesson skills (keys match Lesson.type + SKILL keys)
  listening: require('../../assets/icons/headphones.png'),
  reading: require('../../assets/icons/book-open.png'), // open green book
  fill: require('../../assets/icons/pencil.png'),
  writing: require('../../assets/icons/notepad-pen.png'),
  speaking: require('../../assets/icons/mic.png'), // pink 3D microphone (Ярих)
  mic: require('../../assets/icons/mic.png'),
  grammar: require('../../assets/icons/book-closed.png'), // rulebook
  vocabulary: require('../../assets/icons/book-closed.png'), // book of words

  // Gamification / currency
  xp: require('../../assets/icons/bolt.png'), // lightning bolt (XP)
  sparks: require('../../assets/icons/diamond-blue.png'), // Очирхон
  gem: require('../../assets/icons/diamond-gold.png'),
  streak: require('../../assets/icons/flame.png'), // orange flame drop
  heart: require('../../assets/icons/heart.png'), // lives

  // Features / menu
  trophy: require('../../assets/icons/trophy-gold.png'), // soril / rank
  trophyGreen: require('../../assets/icons/trophy-green.png'),
  stats: require('../../assets/icons/bar-chart.png'), // ахиц
  time: require('../../assets/icons/clock.png'), // review / recent
  saved: require('../../assets/icons/bookmark.png'),
  notifications: require('../../assets/icons/bell.png'),
  home: require('../../assets/icons/home.png'), // purple 3D house (home tab)
  gift: require('../../assets/icons/gift.png'), // rewards
  profile: require('../../assets/icons/person.png'),
  water: require('../../assets/icons/water-drop.png'), // blue drop
} as const;

export type AppIconName = keyof typeof appIcons;
