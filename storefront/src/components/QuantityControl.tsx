import { cx } from "../styles";

type QuantityControlProps = {
  value: number;
  max?: number;
  onChange: (value: number) => void;
};

export function QuantityControl({ value, max = 99, onChange }: QuantityControlProps) {
  return (
    <div className={cx("qty-control")} aria-label="Количество">
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} aria-label="Уменьшить">
        -
      </button>
      <span>{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label="Увеличить">
        +
      </button>
    </div>
  );
}
