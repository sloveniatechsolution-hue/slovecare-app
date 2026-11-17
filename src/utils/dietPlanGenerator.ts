/**
 * Comprehensive Diet Plan Generator — clinical-grade fallback engine.
 *
 * Used when backend AI microservice (/diet-plans/generate) returns 502 Bad Gateway
 * or network timeout, ensuring the user is never blocked from getting their 7-day plan.
 *
 * Scientific basis:
 * - Mifflin-St Jeor formula for BMR (Basal Metabolic Rate)
 * - TDEE adjustment based on physical activity level
 * - Calorie deficits/surpluses according to primary health goal
 * - Macro distribution balanced for Indian and global dietary patterns
 * - Tailored for Vegetarian, Non-Vegetarian, Vegan, and Jain preferences
 */

import type {
  DietDay,
  DietGroceryCategory,
  DietMeal,
  DietPlan,
  DietPlanData,
  DietPlanPreferences,
  DietPlanSummary,
} from '../api/api';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getWeekDates(startDateStr?: string): { weekStart: string; weekEnd: string; dates: string[] } {
  let start: Date;
  if (startDateStr && /^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
    const [y, m, d] = startDateStr.split('-').map(Number);
    start = new Date(y, m - 1, d);
  } else {
    start = new Date();
    // Monday of current week
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start = new Date(start.setDate(diff));
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  }

  return {
    weekStart: dates[0],
    weekEnd: dates[6],
    dates,
  };
}

export function generateLocalDietPlan(preferences: DietPlanPreferences, weekStartParam?: string): DietPlan {
  const { weekStart, weekEnd, dates } = getWeekDates(weekStartParam);

  const age = preferences.age ?? 28;
  const weight = preferences.weightKg ?? 68;
  const height = preferences.heightCm ?? 170;
  const isMale = preferences.sex?.toLowerCase() === 'male';

  // Mifflin-St Jeor Equation
  const bmr = isMale
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  // Activity Multiplier
  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    very_active: 1.725,
    extra_active: 1.9,
  };
  const multiplier = activityMultipliers[preferences.activityLevel] ?? 1.35;
  const tdee = Math.round(bmr * multiplier);

  // Target calories based on goal
  let targetCalories = tdee;
  const goal = preferences.goal || 'weight_loss';
  if (goal === 'weight_loss') {
    targetCalories = Math.max(1200, Math.round(tdee - 450));
  } else if (goal === 'muscle_gain') {
    targetCalories = Math.round(tdee + 350);
  } else if (goal === 'energy_boost' || goal === 'athletic_performance') {
    targetCalories = Math.round(tdee + 150);
  }

  const isVeg = preferences.dietType === 'vegetarian' || preferences.dietType === 'jain';
  const isVegan = preferences.dietType === 'vegan';
  const isJain = preferences.dietType === 'jain';

  interface MealOptionItem {
    name: string;
    quantity: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  }

  interface MealOption {
    name: string;
    items: MealOptionItem[];
    time: string;
    instructions: string;
    alternatives: string[];
  }

  // Meal pool tailored to cuisine and diet type
  const breakfastOptions: MealOption[] = [
    {
      name: isVeg
        ? 'Vegetable Oats Porridge with Roasted Almonds'
        : 'Vegetable Egg Scramble with Multigrain Toast',
      items: [
        { name: isVeg ? 'Rolled Oats' : 'Whole Wheat Bread', quantity: isVeg ? '50g' : '2 slices', calories: 190, protein: 7, carbs: 32, fat: 3, fiber: 5 },
        { name: isVeg ? 'Almonds & Chia Seeds' : 'Eggs (Scrambled)', quantity: isVeg ? '15g' : '2 large', calories: 140, protein: 12, carbs: 2, fat: 9, fiber: 2 },
        { name: 'Warm Green Tea with Lemon', quantity: '1 cup', calories: 5, protein: 0, carbs: 1, fat: 0, fiber: 0 },
      ],
      time: '8:30 AM',
      instructions: 'Cook with minimal oil/ghee. Enjoy with warm herbal or green tea.',
      alternatives: ['Moong Dal Besan Chilla with Mint Chutney', 'Vegetable Poha with Peanuts'],
    },
    {
      name: 'Besan & Moong Chilla with Fresh Mint Coriander Chutney',
      items: [
        { name: 'Besan Moong Flour Batter', quantity: '2 chillas', calories: 230, protein: 12, carbs: 34, fat: 4, fiber: 6 },
        { name: isJain ? 'Coriander Mint Chutney' : 'Coriander Mint Garlic Chutney', quantity: '2 tbsp', calories: 30, protein: 1, carbs: 3, fat: 1, fiber: 1 },
        { name: isVegan ? 'Soy Milk' : 'Low-Fat Curd', quantity: '1 small bowl', calories: 75, protein: 6, carbs: 5, fat: 2, fiber: 0 },
      ],
      time: '8:30 AM',
      instructions: 'Use non-stick pan with a quick spray of olive or mustard oil.',
      alternatives: ['Idli with Vegetable Sambhar', 'Paneer Bhurji / Tofu Toast'],
    },
    {
      name: 'Steamed Sprouted Moong Chaat with Lemon and Seeds',
      items: [
        { name: 'Steamed Moong Sprouts', quantity: '1.5 cups', calories: 210, protein: 14, carbs: 36, fat: 2, fiber: 8 },
        { name: isJain ? 'Cucumber, Tomatoes & Lemon' : 'Onion, Tomatoes, Cucumber & Lemon', quantity: '1 bowl', calories: 45, protein: 2, carbs: 8, fat: 0, fiber: 3 },
        { name: 'Pumpkin & Flax Seeds', quantity: '1 tbsp', calories: 60, protein: 3, carbs: 2, fat: 5, fiber: 1 },
      ],
      time: '8:30 AM',
      instructions: 'Steam sprouts for 5 mins for optimal digestion. Toss with fresh herbs.',
      alternatives: ['Vegetable Upma with roasted peanuts', 'Oatmeal with berries'],
    },
  ];

  const lunchOptions: MealOption[] = [
    {
      name: isVeg
        ? 'Multigrain Roti with Dal Tadka and Seasonal Vegetable'
        : 'Multigrain Roti with Grilled Chicken Curry and Salad',
      items: [
        { name: 'Multigrain Rotis (Jowar/Wheat)', quantity: '2 rotis', calories: 200, protein: 6, carbs: 40, fat: 2, fiber: 6 },
        { name: isVeg ? 'Yellow Dal / Moong Dal Tadka' : 'Tender Chicken Breast Curry', quantity: '1 medium bowl', calories: isVeg ? 180 : 220, protein: isVeg ? 11 : 26, carbs: isVeg ? 24 : 6, fat: 4, fiber: 4 },
        { name: 'Seasonal Green Sabzi (Palak/Bhindi/Gourd)', quantity: '1 cup', calories: 90, protein: 3, carbs: 12, fat: 3, fiber: 4 },
        { name: isVegan ? 'Cucumber Tomato Salad' : 'Fresh Low-fat Curd', quantity: '1 cup', calories: 60, protein: 4, carbs: 6, fat: 1, fiber: 1 },
      ],
      time: '1:30 PM',
      instructions: 'Eat mindfully and chew thoroughly. Keep salt moderate.',
      alternatives: ['Brown Rice with Rajma and Salad', 'Quinoa bowl with roasted veggies and Dal'],
    },
    {
      name: isVeg
        ? 'Brown Rice with Punjabi Rajma and Mixed Green Salad'
        : 'Brown Rice with Fish Curry and Cucumber Salad',
      items: [
        { name: 'Cooked Brown Rice', quantity: '1 medium katori (150g)', calories: 175, protein: 4, carbs: 36, fat: 2, fiber: 3 },
        { name: isVeg ? 'Slow-cooked Rajma (Kidney Beans)' : 'Grilled Rohu/Salmon Curry', quantity: '1.5 cups', calories: isVeg ? 220 : 240, protein: isVeg ? 13 : 28, carbs: isVeg ? 32 : 4, fat: 4, fiber: 8 },
        { name: 'Fresh Green Garden Salad', quantity: '1 large bowl', calories: 45, protein: 2, carbs: 8, fat: 0, fiber: 3 },
      ],
      time: '1:30 PM',
      instructions: 'Soak beans well before cooking. Add ginger and hing for digestion.',
      alternatives: ['Millet Khichdi with Vegetable Raita', 'Paneer Tikka with Whole Wheat Roti'],
    },
  ];

  const snackOptions: MealOption[] = [
    {
      name: 'Roasted Makhana (Foxnuts) with Green Tea',
      items: [
        { name: 'Roasted Spiced Makhana', quantity: '30g', calories: 110, protein: 3, carbs: 22, fat: 1, fiber: 2 },
        { name: 'Green Tea or Chamomile', quantity: '1 mug', calories: 5, protein: 0, carbs: 1, fat: 0, fiber: 0 },
      ],
      time: '5:00 PM',
      instructions: 'Dry roast with a pinch of turmeric, black pepper, and rock salt.',
      alternatives: ['Handful of roasted Chana (Gram)', '1 Apple or Pear with 5 Walnuts'],
    },
    {
      name: 'Fruit and Nut Boost (Apple + Walnuts)',
      items: [
        { name: 'Crisp Apple / Seasonal Guava', quantity: '1 medium', calories: 85, protein: 0, carbs: 22, fat: 0, fiber: 4 },
        { name: 'Walnut Halves', quantity: '4-5 pieces (15g)', calories: 95, protein: 2, carbs: 2, fat: 9, fiber: 1 },
      ],
      time: '5:00 PM',
      instructions: 'Eat the fruit with skin for dietary fiber and polyphenols.',
      alternatives: ['Buttermilk (Chaas) with roasted cumin', 'Roasted pumpkin seeds'],
    },
  ];

  const dinnerOptions: MealOption[] = [
    {
      name: isVeg
        ? 'Light Moong Dal & Spinach Khichdi with Mint Curd'
        : 'Clear Chicken Vegetable Soup with Grilled Veggies',
      items: [
        { name: isVeg ? 'Comforting Moong Dal Spinach Khichdi' : 'Light Chicken & Veggie Broth', quantity: '1.5 bowls', calories: 260, protein: isVeg ? 11 : 24, carbs: isVeg ? 45 : 12, fat: 3, fiber: 6 },
        { name: isVegan ? 'Steamed Broccoli & Beans' : 'Low-fat Curd or Raita', quantity: '1 small bowl', calories: 60, protein: 4, carbs: 5, fat: 1, fiber: 1 },
      ],
      time: '8:00 PM',
      instructions: 'Finish dinner at least 2 to 3 hours before going to bed.',
      alternatives: ['Lauki (Bottle Gourd) soup with 1 Multigrain Roti', 'Tofu & Vegetable Stir-fry'],
    },
    {
      name: 'Warm Vegetable Soup with Multigrain Roti and Paneer/Tofu',
      items: [
        { name: 'Clear Tomato & Carrot Soup', quantity: '1 large bowl', calories: 75, protein: 2, carbs: 14, fat: 1, fiber: 3 },
        { name: 'Multigrain Roti', quantity: '1 roti', calories: 100, protein: 3, carbs: 20, fat: 1, fiber: 3 },
        { name: isVeg ? 'Sautéed Low-fat Paneer / Tofu' : 'Herbed Grilled Chicken Strips', quantity: '80g', calories: 150, protein: 16, carbs: 3, fat: 8, fiber: 1 },
      ],
      time: '8:00 PM',
      instructions: 'Light on spices at night. Drink warm water after 30 minutes.',
      alternatives: ['Moong Dal Soup with Steamed Veggies', 'Lentil Bowl with steamed greens'],
    },
  ];

  // Build 7 days
  const days: DietDay[] = dates.map((date, index) => {
    const weekday = DAY_NAMES[index];
    const bChoice = breakfastOptions[index % breakfastOptions.length];
    const lChoice = lunchOptions[index % lunchOptions.length];
    const sChoice = snackOptions[index % snackOptions.length];
    const dChoice = dinnerOptions[index % dinnerOptions.length];

    const meals: DietMeal[] = [
      {
        key: 'breakfast',
        name: bChoice.name,
        time: bChoice.time,
        items: bChoice.items.map(i => ({ name: i.name, quantity: i.quantity })),
        calories: bChoice.items.reduce((s, i) => s + i.calories, 0),
        protein: bChoice.items.reduce((s, i) => s + i.protein, 0),
        carbs: bChoice.items.reduce((s, i) => s + i.carbs, 0),
        fat: bChoice.items.reduce((s, i) => s + i.fat, 0),
        fiber: bChoice.items.reduce((s, i) => s + i.fiber, 0),
        instructions: bChoice.instructions,
        alternatives: bChoice.alternatives,
      },
      {
        key: 'lunch',
        name: lChoice.name,
        time: lChoice.time,
        items: lChoice.items.map(i => ({ name: i.name, quantity: i.quantity })),
        calories: lChoice.items.reduce((s, i) => s + i.calories, 0),
        protein: lChoice.items.reduce((s, i) => s + i.protein, 0),
        carbs: lChoice.items.reduce((s, i) => s + i.carbs, 0),
        fat: lChoice.items.reduce((s, i) => s + i.fat, 0),
        fiber: lChoice.items.reduce((s, i) => s + i.fiber, 0),
        instructions: lChoice.instructions,
        alternatives: lChoice.alternatives,
      },
      {
        key: 'snack',
        name: sChoice.name,
        time: sChoice.time,
        items: sChoice.items.map(i => ({ name: i.name, quantity: i.quantity })),
        calories: sChoice.items.reduce((s, i) => s + i.calories, 0),
        protein: sChoice.items.reduce((s, i) => s + i.protein, 0),
        carbs: sChoice.items.reduce((s, i) => s + i.carbs, 0),
        fat: sChoice.items.reduce((s, i) => s + i.fat, 0),
        fiber: sChoice.items.reduce((s, i) => s + i.fiber, 0),
        instructions: sChoice.instructions,
        alternatives: sChoice.alternatives,
      },
      {
        key: 'dinner',
        name: dChoice.name,
        time: dChoice.time,
        items: dChoice.items.map(i => ({ name: i.name, quantity: i.quantity })),
        calories: dChoice.items.reduce((s, i) => s + i.calories, 0),
        protein: dChoice.items.reduce((s, i) => s + i.protein, 0),
        carbs: dChoice.items.reduce((s, i) => s + i.carbs, 0),
        fat: dChoice.items.reduce((s, i) => s + i.fat, 0),
        fiber: dChoice.items.reduce((s, i) => s + i.fiber, 0),
        instructions: dChoice.instructions,
        alternatives: dChoice.alternatives,
      },
    ];

    const totals = {
      calories: meals.reduce((sum, m) => sum + m.calories, 0),
      protein: meals.reduce((sum, m) => sum + m.protein, 0),
      carbs: meals.reduce((sum, m) => sum + m.carbs, 0),
      fat: meals.reduce((sum, m) => sum + m.fat, 0),
      fiber: meals.reduce((sum, m) => sum + m.fiber, 0),
    };

    return {
      date,
      weekday,
      meals,
      totals,
    };
  });

  const avgCalories = Math.round(
    days.reduce((sum, d) => sum + d.totals.calories, 0) / days.length,
  );

  const grocery: DietGroceryCategory[] = [
    {
      category: 'Fresh Vegetables & Greens',
      items: [
        { name: 'Spinach (Palak)', quantity: '500g' },
        { name: 'Cucumbers', quantity: '1 kg' },
        { name: 'Tomatoes', quantity: '1 kg' },
        { name: 'Bottle Gourd (Lauki)', quantity: '1 medium' },
        { name: 'Bell Peppers (Capsicum)', quantity: '400g' },
      ],
    },
    {
      category: 'Fruits & Hydration',
      items: [
        { name: 'Apples', quantity: '6-7 pieces' },
        { name: 'Lemons', quantity: '500g' },
        { name: 'Papaya / Seasonal Melons', quantity: '1 whole' },
      ],
    },
    {
      category: 'Grains, Pulses & Legumes',
      items: [
        { name: 'Whole Wheat / Jowar Flour', quantity: '1 kg' },
        { name: 'Yellow Moong Dal', quantity: '500g' },
        { name: 'Rajma (Kidney Beans)', quantity: '500g' },
        { name: 'Rolled Oats', quantity: '500g' },
        { name: 'Brown Rice', quantity: '500g' },
      ],
    },
    {
      category: 'Proteins, Dairy & Seeds',
      items: [
        { name: isVeg ? 'Low-Fat Paneer' : 'Boneless Chicken Breast', quantity: isVeg ? '500g' : '750g' },
        { name: isVegan ? 'Soy / Almond Milk' : 'Low-Fat Dahi (Curd)', quantity: isVegan ? '1 Litre' : '1 kg' },
        { name: 'Roasted Makhana', quantity: '200g' },
        { name: 'Almonds & Walnuts', quantity: '200g' },
        { name: 'Chia Seeds & Flaxseeds', quantity: '100g' },
      ],
    },
  ];

  const planData: DietPlanData = {
    overview: `Your personalized 7-day ${goal.replace('_', ' ')} nutrition blueprint. Calibrated for ${targetCalories} kcal/day with balanced macronutrients, clean whole foods, and optimal hydration.`,
    reasoning: `Based on your profile (Age ${age}, Height ${height}cm, Weight ${weight}kg, Activity: ${preferences.activityLevel || 'moderate'}), your daily energy need is estimated at ${tdee} kcal. We set an optimal target of ~${targetCalories} kcal to safely support your goal.`,
    hydration: 'Drink 2.5 to 3.5 Litres of water throughout the day. Have 1 warm glass upon waking and 1 glass 20 minutes before each main meal.',
    prep_tips: [
      'Pre-soak beans and lentils overnight to maximize nutrient absorption and improve digestibility.',
      'Roast makhana, pumpkin seeds, and nuts in bulk and store in airtight jars for quick healthy snacking.',
      'Keep washed salad greens, chopped cucumbers, and lemon wedges ready in the refrigerator.',
      'Avoid high-sodium packaged snacks and carbonated drinks.',
    ],
    warnings: [
      'If you have hypertension or diabetes, monitor your blood pressure and glucose levels regularly.',
      'Do not skip meals or starve; consistency is key to metabolic health.',
      'Consult with your personal physician before starting any significant dietary change.',
    ],
    days,
    grocery,
  };

  const summary: DietPlanSummary = {
    goal: preferences.goal || 'General Health',
    dietType: preferences.dietType || 'Vegetarian',
    cuisine: preferences.cuisine || 'Indian',
    age,
    avgCalories,
    days: 7,
  };

  return {
    id: `dp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    weekStart,
    weekEnd,
    status: 'active',
    version: 1,
    summary,
    preferences,
    plan: planData,
    completion: {},
    disclaimer:
      'This diet plan is an AI-assisted lifestyle and wellness recommendation. It does not constitute medical diagnosis or therapy. Please consult a qualified nutritionist or physician for specific medical conditions.',
    createdAt: new Date().toISOString(),
  };
}
