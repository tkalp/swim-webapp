export type Swimmer = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: string;
};

export type EventKey = {
  distance: number;
  stroke: string;
  poolType: string;
};

export type SwimmerQualification = {
  swimmer: Swimmer;
  age: number;
  bestTimes: Map<string, any>; // BestTimeResult from workoutResultService
  qualifiedCount: number;
  closeCount: number;
};

export type StandardsCache = Map<string, number>; // key: "distance-stroke-poolType-age-sex" -> time in seconds

export const COMMON_EVENTS: EventKey[] = [
  { distance: 50, stroke: 'free', poolType: 'SCM' },
  { distance: 100, stroke: 'free', poolType: 'SCM' },
  { distance: 200, stroke: 'free', poolType: 'SCM' },
  { distance: 400, stroke: 'free', poolType: 'SCM' },
  { distance: 50, stroke: 'back', poolType: 'SCM' },
  { distance: 100, stroke: 'back', poolType: 'SCM' },
  { distance: 200, stroke: 'back', poolType: 'SCM' },
  { distance: 50, stroke: 'breast', poolType: 'SCM' },
  { distance: 100, stroke: 'breast', poolType: 'SCM' },
  { distance: 200, stroke: 'breast', poolType: 'SCM' },
  { distance: 50, stroke: 'fly', poolType: 'SCM' },
  { distance: 100, stroke: 'fly', poolType: 'SCM' },
  { distance: 200, stroke: 'fly', poolType: 'SCM' },
  { distance: 200, stroke: 'im', poolType: 'SCM' },
  { distance: 400, stroke: 'im', poolType: 'SCM' },
];
