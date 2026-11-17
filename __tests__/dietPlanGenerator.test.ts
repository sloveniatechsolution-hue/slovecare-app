import { generateLocalDietPlan } from '../src/utils/dietPlanGenerator';
import type { DietPlanPreferences } from '../src/api/api';

describe('dietPlanGenerator', () => {
  it('generates a complete 7-day diet plan matching DietPlanData schema', () => {
    const prefs: DietPlanPreferences = {
      age: 30,
      sex: 'male',
      heightCm: 175,
      weightKg: 72,
      goalWeightKg: 68,
      country: 'India',
      state: 'Rajasthan',
      city: 'Udaipur',
      activityLevel: 'moderate',
      goal: 'weight_loss',
      medicalConditions: [],
      allergies: [],
      dietaryRestrictions: [],
      medications: '',
      pregnancyStatus: 'not_applicable',
      exerciseRoutine: '30 mins walking',
      sleepSchedule: '11 PM - 7 AM',
      dailyRoutine: 'Desk job',
      dietType: 'vegetarian',
      dietTypeOther: '',
      cuisine: 'North Indian',
      favoriteFoods: ['Paneer', 'Dal'],
      dislikedFoods: ['Bitter gourd'],
      mealsPerDay: 4,
      mealTimings: '8am, 1pm, 5pm, 8pm',
      budget: 'moderate',
      cookingPreference: 'home_cooked',
      restrictionsNotes: '',
    };

    const plan = generateLocalDietPlan(prefs);

    expect(plan).toBeDefined();
    expect(plan.id).toMatch(/^dp-/);
    expect(plan.summary.days).toBe(7);
    expect(plan.summary.goal).toBe('weight_loss');
    expect(plan.plan.days).toHaveLength(7);

    // Each day has meals and totals
    for (const day of plan.plan.days) {
      expect(day.meals.length).toBeGreaterThanOrEqual(3);
      expect(day.totals.calories).toBeGreaterThan(1000);
      expect(day.totals.protein).toBeGreaterThan(30);
    }

    // Grocery categories exist
    expect(plan.plan.grocery.length).toBeGreaterThanOrEqual(4);
    expect(plan.plan.overview).toContain('weight loss');
    expect(plan.plan.hydration).toContain('water');
  });

  it('adjusts macros for non-vegetarian preferences', () => {
    const prefs: DietPlanPreferences = {
      age: 25,
      sex: 'female',
      heightCm: 162,
      weightKg: 58,
      goalWeightKg: null,
      country: 'India',
      state: 'Delhi',
      city: 'New Delhi',
      activityLevel: 'light',
      goal: 'muscle_gain',
      medicalConditions: [],
      allergies: [],
      dietaryRestrictions: [],
      medications: '',
      pregnancyStatus: 'not_applicable',
      exerciseRoutine: 'Gym',
      sleepSchedule: '',
      dailyRoutine: '',
      dietType: 'non_vegetarian',
      dietTypeOther: '',
      cuisine: 'Indian',
      favoriteFoods: ['Chicken', 'Eggs'],
      dislikedFoods: [],
      mealsPerDay: 3,
      mealTimings: '',
      budget: '',
      cookingPreference: '',
      restrictionsNotes: '',
    };

    const plan = generateLocalDietPlan(prefs);
    expect(plan.summary.dietType).toBe('non_vegetarian');
    // Check non-veg meal presence
    const allMealNames = plan.plan.days.flatMap(d => d.meals.map(m => m.name));
    expect(allMealNames.some(name => /chicken|egg|fish/i.test(name))).toBe(true);
  });
});
