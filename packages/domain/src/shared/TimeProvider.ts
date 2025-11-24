import { DateTime } from "../valueObjects/DateTime";

export interface TimeProvider {
  now(): DateTime;
}
