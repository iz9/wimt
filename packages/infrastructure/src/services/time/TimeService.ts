import dayjs from "dayjs";
import { injectable } from "inversify";

import { ITimeService } from "@wimt/domain/shared";
import { DateTime } from "@wimt/domain/valueObjects";

@injectable()
export class TimeService implements ITimeService {
  now() {
    return DateTime.create(dayjs().valueOf());
  }
}
