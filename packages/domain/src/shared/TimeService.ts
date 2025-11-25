import { DateTime } from "../valueObjects/DateTime";

export interface TimeService {
  now(): DateTime;
}
