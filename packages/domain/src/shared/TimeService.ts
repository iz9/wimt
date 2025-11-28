import { DateTime } from "../valueObjects";

export interface ITimeService {
  now(): DateTime;
}

export const TimeServiceSymbol = Symbol("TimeService");
