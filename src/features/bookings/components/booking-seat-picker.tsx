"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import type { AvailableSeat } from "@/features/bookings/actions/get-available-seats.action";
import { cn } from "@/lib/utils";

/** The row that clears the seat: the booking is saved without one. */
const NO_SEAT: AvailableSeat = {
  id: "",
  serial_number: "No seat (assign later)",
  availability: "available",
  conflict_booking_number: null,
  unusable_reason: null,
};

interface BookingSeatPickerProps {
  id: string;
  value: string;
  onValueChange: (seatId: string) => void;
  seats: AvailableSeat[];
  /** The seat already on the booking, kept in the list when it is not returned for the period. */
  currentSeat?: Pick<AvailableSeat, "id" | "serial_number"> | null;
  categoryName?: string | null;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

/** What the row says about the seat: available, held by a booking, or why it cannot be used. */
export function seatStateText(seat: AvailableSeat): string {
  if (seat.availability === "conflict") {
    return `Conflict${seat.conflict_booking_number ? ` · ${seat.conflict_booking_number}` : ""}`;
  }
  if (seat.availability === "not_usable") {
    return seat.unusable_reason ?? "Not usable";
  }

  return "Available";
}

/** A seat can be chosen only when it is available for the period. */
export function isSeatSelectable(seat: AvailableSeat): boolean {
  return seat.availability === "available";
}

export function BookingSeatPicker({
  id,
  value,
  onValueChange,
  seats,
  currentSeat,
  categoryName,
  disabled,
  invalid,
  describedBy,
}: BookingSeatPickerProps) {
  const list = [...seats];
  if (currentSeat && !list.some((seat) => seat.id === currentSeat.id)) {
    list.unshift({
      ...NO_SEAT,
      id: currentSeat.id,
      serial_number: currentSeat.serial_number,
    });
  }
  const items = [NO_SEAT, ...list];
  const selected = list.find((seat) => seat.id === value) ?? null;

  return (
    <Combobox
      items={items}
      value={selected}
      onValueChange={(next) => onValueChange(next?.id ?? "")}
      itemToStringLabel={(seat) =>
        seat.id && categoryName
          ? `${seat.serial_number} · ${categoryName}`
          : seat.id
            ? seat.serial_number
            : ""
      }
      isItemEqualToValue={(a, b) => a.id === b.id}
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        placeholder="Search or select seat"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className="h-11 pointer-coarse:h-11"
      />
      <ComboboxContent>
        <ComboboxEmpty>No seat found.</ComboboxEmpty>
        <ComboboxList>
          {(seat: AvailableSeat) => (
            <ComboboxItem
              key={seat.id || "no-seat"}
              value={seat}
              disabled={!isSeatSelectable(seat)}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="truncate">{seat.serial_number}</span>
                {seat.id ? (
                  <span
                    className={cn(
                      "shrink-0 text-xs text-muted-foreground",
                      seat.availability === "conflict" && "text-danger-fg",
                    )}
                  >
                    {seatStateText(seat)}
                  </span>
                ) : null}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
