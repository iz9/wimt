import { AggregateRoot } from "./AggregateRoot";
import { makeId, ULID } from "../valueObjects/ulid";
import { DateTime } from "../valueObjects/DateTime";
import { CategoryName } from "../valueObjects/CategoryName";
import { Color } from "../valueObjects/Color";
import { Icon } from "../valueObjects/Icon";
import { isNil } from "es-toolkit";
import { CategoryCreated } from "../events/CategoryCreated";
import { CategoryEdited } from "../events/CategoryEdited";

export class Category extends AggregateRoot {
  public readonly id: ULID;
  public name: CategoryName;
  public readonly createdAt: DateTime;
  public color: Color | null;
  public icon: Icon | null;
  constructor(props: CategoryProps) {
    super();
    this.name = props.name;
    this.createdAt = props.createdAt;
    this.id = props.id ?? makeId();
    this.color = props.color ?? null;
    this.icon = props.icon ?? null;
    if (isNil(props.id)) {
      this.addEvent(new CategoryCreated(this.id, this.createdAt));
    }
  }

  setName(name: CategoryName): void {
    this.name = name;
    this.addEvent(new CategoryEdited(this.id, this.createdAt));
  }

  setIcon(icon: Icon): void {
    this.icon = icon;
    this.addEvent(new CategoryEdited(this.id, this.createdAt));
  }

  setColor(color: Color): void {
    this.color = color;
    this.addEvent(new CategoryEdited(this.id, this.createdAt));
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      createdAt: this.createdAt,
      color: this.color,
      icon: this.icon,
    };
  }
}

type CategoryProps = {
  id?: ULID;
  name: CategoryName;
  createdAt: DateTime;
  color?: Color;
  icon?: Icon;
};
