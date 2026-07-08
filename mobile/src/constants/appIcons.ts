/**
 * 3D glossy brand icons (assets/icons/iconN.png) → semantic names.
 *
 * The raw files are named icon1..icon20; screens should NEVER require() them by
 * number. Import from here so every surface uses the same picture for the same
 * concept, and so a re-export only has to be re-pointed in one place.
 *
 * Render them with the <AppIcon> component (keeps sizing + resizeMode crisp).
 * NOTE: the source PNGs are low-resolution (≈140–290px). Render small (≤~40pt)
 * so they stay sharp; re-export at 512px+ before using them larger.
 */
export const appIcons = {
  // Lesson skills (keys match Lesson.type + SKILL keys)
  listening: require('../../assets/icons/icon1.png'), // headphones
  reading: require('../../assets/icons/icon6.png'), // open green book
  fill: require('../../assets/icons/icon11.png'), // pencil
  writing: require('../../assets/icons/icon16.png'), // notepad + pen
  grammar: require('../../assets/icons/icon3.png'), // closed book (rulebook)
  vocabulary: require('../../assets/icons/icon3.png'), // book of words

  // Gamification / currency
  xp: require('../../assets/icons/icon2.png'), // lightning bolt (XP)
  sparks: require('../../assets/icons/icon7.png'), // blue diamond (Очирхон)
  gem: require('../../assets/icons/icon18.png'), // gold diamond
  streak: require('../../assets/icons/icon12.png'), // orange flame drop
  heart: require('../../assets/icons/icon15.png'), // heart / lives

  // Features / menu
  trophy: require('../../assets/icons/icon17.png'), // gold trophy (soril / rank)
  trophyGreen: require('../../assets/icons/icon8.png'), // green trophy
  stats: require('../../assets/icons/icon9.png'), // bar chart (ахиц)
  time: require('../../assets/icons/icon10.png'), // clock (review / recent)
  saved: require('../../assets/icons/icon14.png'), // bookmark
  notifications: require('../../assets/icons/icon19.png'), // bell
  settings: require('../../assets/icons/icon20.png'), // gear
  gift: require('../../assets/icons/icon5.png'), // gift box (rewards)
  profile: require('../../assets/icons/icon4.png'), // person
  water: require('../../assets/icons/icon13.png'), // blue drop
} as const;

export type AppIconName = keyof typeof appIcons;
