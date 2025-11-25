import { DateTime } from "../valueObjects/DateTime";

export interface TimeProvider {
  nowDateTime(): DateTime;
}
