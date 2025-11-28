import { isNil } from "es-toolkit";

import { CategoryCreated, CategoryEdited } from "../events";
import { CategoryName, Color, DateTime, Icon, ULID } from "../valueObjects";
import { AggregateRoot } from "./AggregateRoot";

type CategoryProps = {
  id?: ULID;
  name: CategoryName;
  createdAt: DateTime;
  color?: Color;
  icon?: Icon;
};

export class Category extends AggregateRoot {
  public color: Color | null;
  public readonly createdAt!: DateTime;
  public icon: Icon | null;
  public name: CategoryName;

  constructor(props: CategoryProps) {
    super(props.id);
    this.name = props.name;
    this.defineImmutable("createdAt", props.createdAt);
    this.color = props.color ?? null;
    this.icon = props.icon ?? null;

    if (isNil(props.id)) {
      this.addEvent(new CategoryCreated(this.id, this.createdAt));
    }
  }

  setColor(color: Color): void {
    this.color = color;
    this.addEvent(new CategoryEdited(this.id, this.createdAt));
  }

  setIcon(icon: Icon): void {
    this.icon = icon;
    this.addEvent(new CategoryEdited(this.id, this.createdAt));
  }

  setName(name: CategoryName): void {
    this.name = name;
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
