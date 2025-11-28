import { ITimeService } from "@wimt/domain/shared";
import { injectable } from "inversify";
import dayjs from "dayjs";
import { DateTime } from "@wimt/domain/valueObjects";

@injectable()
export class TimeService implements ITimeService {
  now() {
    return DateTime.create(dayjs().valueOf());
  }
}
