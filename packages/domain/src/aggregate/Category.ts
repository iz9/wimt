import { AggregateRoot } from "./AggregateRoot";
import { makeId, ULID } from "../valueObjects/ulid";
import { DateTime } from "../valueObjects/DateTime";
import { CategoryName } from "../valueObjects/CategoryName";
import { Color } from "../valueObjects/Color";
import { Icon } from "../valueObjects/Icon";

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
  }

  setName(name: CategoryName): void {
    this.name = name;
  }

  setIcon(icon: Icon): void {
    this.icon = icon;
  }

  setColor(color: Color): void {
    this.color = color;
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
