/**
 * GarageGrid Component
 *
 * Renders a 10x10 CSS Grid visualization of the parking garage.
 * Each space is color-coded by type and status (available, occupied, selected, held).
 * Click a spot to select it and open the booking panel.
 */

import { useMemo } from 'react';
import { useGarage } from '../../context/GarageContext';
import type { Space, SpotType } from '../../types';

// ── Helper Functions ────────────────────────────────────────────────

/**
 * Check if a space is currently occupied by an active reservation.
 *
 * @param spaceId - The space ID to check (e.g., "R0C5")
 * @param currentTime - Current simulation time as decimal hour (e.g., 14.5 = 2:30 PM)
 * @param reservations - Array of all reservations to check against
 * @returns True if the space has an ACTIVE reservation covering the current time
 */
function isOccupied(
  spaceId: string,
  currentTime: number,
  reservations: Array<{ space_id: string; start_time: number; end_time: number; status: string }>
): boolean {
  return reservations.some(
    (r) =>
      r.space_id === spaceId &&
      r.status === 'ACTIVE' &&
      r.start_time <= currentTime &&
      currentTime < r.end_time
  );
}

/**
 * Check if a space is held by any client.
 */
function isHeld(spaceId: string, heldSpaceIds: Record<string, number>): boolean {
  return spaceId in heldSpaceIds;
}

/**
 * Get spot type icon/label for display.
 */
function getSpotIcon(type: SpotType): string {
  switch (type) {
    case 'EV':
      return '⚡';
    case 'MOTORCYCLE':
      return '🏍';
    default:
      return '';
  }
}

/**
 * Get the appropriate Tailwind classes for a space based on its state.
 *
 * Color coding:
 * - Yellow: Currently selected by this user
 * - Red: Occupied by an active reservation
 * - Orange: Held by another user
 * - Blue: Available EV charging spot
 * - Purple: Available motorcycle spot
 * - Green (shades): Available standard spot (darker = higher price)
 *
 * @param space - The space to style
 * @param isSpaceOccupied - Whether the space has an active reservation
 * @param isSpaceHeld - Whether the space is held by another user
 * @param isSelected - Whether this user has selected the space
 * @param price - Current price for intensity shading
 * @returns Tailwind CSS class string
 */
function getSpotClasses(
  space: Space,
  isSpaceOccupied: boolean,
  isSpaceHeld: boolean,
  isSelected: boolean,
  price: number
): string {
  const baseClasses = 'w-12 h-12 rounded cursor-pointer transition-all duration-150 flex items-center justify-center text-xs font-medium relative';

  if (isSelected) {
    return `${baseClasses} bg-yellow-400 text-gray-900 ring-2 ring-yellow-300 ring-offset-2 ring-offset-wc-blue scale-110 z-10`;
  }

  if (isSpaceOccupied) {
    return `${baseClasses} bg-red-600/80 text-white cursor-not-allowed`;
  }

  if (isSpaceHeld) {
    return `${baseClasses} bg-orange-500/80 text-white cursor-not-allowed`;
  }

  // Available - color by type
  switch (space.type) {
    case 'EV':
      return `${baseClasses} bg-blue-500 hover:bg-blue-400 text-white`;
    case 'MOTORCYCLE':
      return `${baseClasses} bg-purple-500 hover:bg-purple-400 text-white`;
    default:
      // Standard spots - shade by price (higher = warmer)
      if (price > 35) {
        return `${baseClasses} bg-green-700 hover:bg-green-600 text-white`;
      } else if (price > 25) {
        return `${baseClasses} bg-green-600 hover:bg-green-500 text-white`;
      } else if (price > 15) {
        return `${baseClasses} bg-green-500 hover:bg-green-400 text-white`;
      }
      return `${baseClasses} bg-green-400 hover:bg-green-300 text-gray-900`;
  }
}

/**
 * Format price for display in tooltip.
 */
function formatPrice(price: number): string {
  return `$${price.toFixed(2)}/hr`;
}

// ── SpaceCell Component ─────────────────────────────────────────────

interface SpaceCellProps {
  space: Space;
  isOccupied: boolean;
  isHeld: boolean;
  isSelected: boolean;
  price: number;
  onClick: () => void;
}

function SpaceCell({ space, isOccupied, isHeld, isSelected, price, onClick }: SpaceCellProps) {
  const icon = getSpotIcon(space.type);
  const classes = getSpotClasses(space, isOccupied, isHeld, isSelected, price);

  return (
    <div
      className={classes}
      onClick={onClick}
      title={`${space.id} | ${space.type} | Zone ${space.zone} | ${formatPrice(price)}`}
    >
      {icon && <span className="text-sm">{icon}</span>}
      {isOccupied && <span className="text-[10px]">●</span>}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export function GarageGrid() {
  const { state, send, dispatch } = useGarage();
  const { garageState, prices, selectedSpaceId } = state;

  // Build a 2D grid from the spaces array
  const grid = useMemo(() => {
    if (!garageState) return [];

    const rows: Space[][] = [];
    for (let r = 0; r < 10; r++) {
      const row: Space[] = [];
      for (let c = 0; c < 10; c++) {
        const space = garageState.spaces.find((s) => s.row === r && s.col === c);
        if (space) row.push(space);
      }
      rows.push(row);
    }
    return rows;
  }, [garageState]);

  const handleSpaceClick = (space: Space) => {
    if (!garageState) return;

    const occupied = isOccupied(
      space.id,
      garageState.current_time,
      garageState.reservations
    );
    const held = isHeld(space.id, garageState.held_space_ids);

    // Can't select occupied or held spots (unless it's our own hold)
    if (occupied) {
      dispatch({ type: 'SET_ERROR', payload: 'This spot is currently occupied' });
      return;
    }

    if (held && space.id !== selectedSpaceId) {
      dispatch({ type: 'SET_ERROR', payload: 'This spot is held by another user' });
      return;
    }

    // If clicking on already-selected spot, deselect
    if (space.id === selectedSpaceId) {
      send({ type: 'release_spot', space_id: space.id });
      return;
    }

    // Release previous selection if any
    if (selectedSpaceId) {
      send({ type: 'release_spot', space_id: selectedSpaceId });
    }

    // Select the new spot
    send({ type: 'select_spot', space_id: space.id });
  };

  if (!garageState) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-400">Loading garage...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Entrance marker */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div className="w-24 h-0.5 bg-gray-600" />
        <span className="px-3 py-1 bg-wc-dark rounded text-wc-gold font-medium">
          ENTRANCE
        </span>
        <div className="w-24 h-0.5 bg-gray-600" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-10 gap-1.5 p-4 bg-wc-dark/50 rounded-lg">
        {grid.map((row) =>
          row.map((space) => {
            const spaceOccupied = isOccupied(
              space.id,
              garageState.current_time,
              garageState.reservations
            );
            const spaceHeld = isHeld(space.id, garageState.held_space_ids);
            const spaceSelected = space.id === selectedSpaceId;
            const price = prices[space.id]?.final_price ?? 0;

            return (
              <SpaceCell
                key={space.id}
                space={space}
                isOccupied={spaceOccupied}
                isHeld={spaceHeld && !spaceSelected}
                isSelected={spaceSelected}
                price={price}
                onClick={() => handleSpaceClick(space)}
              />
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-green-500" />
          <span>Standard</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-blue-500" />
          <span>EV Charging</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-purple-500" />
          <span>Motorcycle</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-red-600" />
          <span>Occupied</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-yellow-400" />
          <span>Selected</span>
        </div>
      </div>
    </div>
  );
}
