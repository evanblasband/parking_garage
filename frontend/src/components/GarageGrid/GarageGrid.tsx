/**
 * GarageGrid Component
 *
 * Renders a realistic parking garage visualization with:
 * - Two rows of angled parking on each side of a central driving lane
 * - Zone labels (A, B, C) indicating distance from entrance
 * - Color-coded spots by type and occupancy status
 * - Click interaction to select spots for booking
 */

import { useMemo } from 'react';
import { useGarage } from '../../context/GarageContext';
import type { Space, SpotType } from '../../types';

// ── Helper Functions ────────────────────────────────────────────────

/**
 * Check if a space is currently occupied by an active reservation.
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
 */
function getSpotClasses(
  space: Space,
  isSpaceOccupied: boolean,
  isSpaceHeld: boolean,
  isSelected: boolean,
  price: number,
  isLeftSide: boolean
): string {
  // Angled spots - taller than wide, with rotation effect via skew
  const baseClasses = `w-10 h-16 cursor-pointer transition-all duration-150 flex items-center justify-center text-xs font-medium relative border-2 ${isLeftSide ? 'skew-y-6 rounded-l-sm rounded-r-md' : '-skew-y-6 rounded-r-sm rounded-l-md'}`;

  if (isSelected) {
    return `${baseClasses} bg-yellow-400 text-gray-900 ring-2 ring-yellow-300 ring-offset-2 ring-offset-gray-800 scale-110 z-10 border-yellow-300`;
  }

  if (isSpaceOccupied) {
    return `${baseClasses} bg-red-600/80 text-white cursor-not-allowed border-red-700`;
  }

  if (isSpaceHeld) {
    return `${baseClasses} bg-orange-500/80 text-white cursor-not-allowed border-orange-600`;
  }

  // Available - color by type
  switch (space.type) {
    case 'EV':
      return `${baseClasses} bg-blue-500 hover:bg-blue-400 text-white border-blue-600`;
    case 'MOTORCYCLE':
      return `${baseClasses} bg-purple-500 hover:bg-purple-400 text-white border-purple-600`;
    default:
      // Standard spots - shade by price (higher = darker green)
      if (price > 35) {
        return `${baseClasses} bg-green-700 hover:bg-green-600 text-white border-green-800`;
      } else if (price > 25) {
        return `${baseClasses} bg-green-600 hover:bg-green-500 text-white border-green-700`;
      } else if (price > 15) {
        return `${baseClasses} bg-green-500 hover:bg-green-400 text-white border-green-600`;
      }
      return `${baseClasses} bg-green-400 hover:bg-green-300 text-gray-900 border-green-500`;
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
  isLeftSide: boolean;
}

function SpaceCell({ space, isOccupied, isHeld, isSelected, price, onClick, isLeftSide }: SpaceCellProps) {
  const icon = getSpotIcon(space.type);
  const classes = getSpotClasses(space, isOccupied, isHeld, isSelected, price, isLeftSide);

  return (
    <div
      className={classes}
      onClick={onClick}
      title={`${space.id} | ${space.type} | Zone ${space.zone} | ${formatPrice(price)}`}
    >
      <span className={`${isLeftSide ? '-skew-y-6' : 'skew-y-6'}`}>
        {icon && <span className="text-sm">{icon}</span>}
        {isOccupied && !icon && <span className="text-[10px]">●</span>}
      </span>
    </div>
  );
}

// ── Zone Label Component ────────────────────────────────────────────

interface ZoneLabelProps {
  zone: string;
  description: string;
  color: string;
}

function ZoneLabel({ zone, description, color }: ZoneLabelProps) {
  return (
    <div className="absolute -left-14 top-1/2 -translate-y-1/2 flex flex-col items-center">
      <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center font-bold text-white text-sm shadow-lg`}>
        {zone}
      </div>
      <span className="text-[9px] text-gray-400 mt-1">{description}</span>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export function GarageGrid() {
  const { state, send, dispatch } = useGarage();
  const { garageState, prices, selectedSpaceId } = state;

  // Build parking layout: 5 columns on left side, 5 columns on right side
  // Organized into 3 zones based on row position
  const layout = useMemo(() => {
    if (!garageState) return { zoneA: { left: [], right: [] }, zoneB: { left: [], right: [] }, zoneC: { left: [], right: [] } };

    // Reorganize the 10x10 grid into left side (cols 0-4) and right side (cols 5-9)
    const zones = {
      zoneA: { left: [] as Space[][], right: [] as Space[][] },
      zoneB: { left: [] as Space[][], right: [] as Space[][] },
      zoneC: { left: [] as Space[][], right: [] as Space[][] },
    };

    // Zone A: Rows 0-2 (near entrance)
    // Zone B: Rows 3-6 (middle)
    // Zone C: Rows 7-9 (far from entrance)
    for (let r = 0; r < 10; r++) {
      const leftRow: Space[] = [];
      const rightRow: Space[] = [];

      for (let c = 0; c < 10; c++) {
        const space = garageState.spaces.find((s) => s.row === r && s.col === c);
        if (space) {
          if (c < 5) {
            leftRow.push(space);
          } else {
            rightRow.push(space);
          }
        }
      }

      if (r < 3) {
        zones.zoneA.left.push(leftRow);
        zones.zoneA.right.push(rightRow);
      } else if (r < 7) {
        zones.zoneB.left.push(leftRow);
        zones.zoneB.right.push(rightRow);
      } else {
        zones.zoneC.left.push(leftRow);
        zones.zoneC.right.push(rightRow);
      }
    }

    return zones;
  }, [garageState]);

  const handleSpaceClick = (space: Space) => {
    if (!garageState) return;

    const occupied = isOccupied(
      space.id,
      garageState.current_time,
      garageState.reservations
    );
    const held = isHeld(space.id, garageState.held_space_ids);

    if (occupied) {
      dispatch({ type: 'SET_ERROR', payload: 'This spot is currently occupied' });
      return;
    }

    if (held && space.id !== selectedSpaceId) {
      dispatch({ type: 'SET_ERROR', payload: 'This spot is held by another user' });
      return;
    }

    if (space.id === selectedSpaceId) {
      send({ type: 'release_spot', space_id: space.id });
      return;
    }

    dispatch({ type: 'CLEAR_LAST_BOOKING' });

    if (selectedSpaceId) {
      send({ type: 'release_spot', space_id: selectedSpaceId });
    }

    send({ type: 'select_spot', space_id: space.id });
  };

  const renderParkingSection = (
    leftRows: Space[][],
    rightRows: Space[][],
    zoneKey: string,
    zoneLabel: { zone: string; description: string; color: string }
  ) => {
    if (!garageState) return null;

    return (
      <div className="relative flex items-center justify-center gap-6 py-3" key={zoneKey}>
        {/* Zone Label */}
        <ZoneLabel {...zoneLabel} />

        {/* Left parking section */}
        <div className="flex flex-col gap-0.5">
          {leftRows.map((row, rowIdx) => (
            <div key={`${zoneKey}-left-${rowIdx}`} className="flex gap-0.5">
              {row.map((space) => {
                const spaceOccupied = isOccupied(space.id, garageState.current_time, garageState.reservations);
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
                    isLeftSide={true}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Central driving lane */}
        <div className="w-20 h-full bg-gray-700/40 rounded flex flex-col items-center justify-center relative">
          {/* Lane markings - dashed center line */}
          <div className="absolute inset-y-2 left-1/2 -translate-x-1/2 w-0.5 flex flex-col gap-2">
            {[...Array(Math.max(leftRows.length * 2, 4))].map((_, i) => (
              <div key={i} className="w-0.5 h-3 bg-yellow-500/70 rounded" />
            ))}
          </div>
          {/* Directional arrows */}
          <div className="text-gray-500 text-xs rotate-90 whitespace-nowrap">
            ↑ ↓
          </div>
        </div>

        {/* Right parking section */}
        <div className="flex flex-col gap-0.5">
          {rightRows.map((row, rowIdx) => (
            <div key={`${zoneKey}-right-${rowIdx}`} className="flex gap-0.5">
              {row.map((space) => {
                const spaceOccupied = isOccupied(space.id, garageState.current_time, garageState.reservations);
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
                    isLeftSide={false}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!garageState) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-400">Loading garage...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* Main Garage Container */}
      <div className="bg-gray-800/60 rounded-2xl p-6 pl-16 border border-gray-700/50 relative">
        {/* Top curved section (entrance area) */}
        <div className="flex justify-center mb-2">
          <div className="w-80 h-10 border-t-4 border-l-4 border-r-4 border-gray-600/60 rounded-t-full flex items-end justify-center pb-1">
            <div className="flex items-center gap-2 px-4 py-1 bg-wc-dark rounded border border-gray-600">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <span className="text-green-400 font-bold text-xs tracking-wide">ENTRANCE</span>
            </div>
          </div>
        </div>

        {/* Zone A - Premium (Near Entrance) */}
        {renderParkingSection(
          layout.zoneA.left,
          layout.zoneA.right,
          'zoneA',
          { zone: 'A', description: 'Premium', color: 'bg-wc-red' }
        )}

        {/* Separator */}
        <div className="h-px bg-gray-600/30 my-2" />

        {/* Zone B - Standard (Middle) */}
        {renderParkingSection(
          layout.zoneB.left,
          layout.zoneB.right,
          'zoneB',
          { zone: 'B', description: 'Standard', color: 'bg-gray-500' }
        )}

        {/* Separator */}
        <div className="h-px bg-gray-600/30 my-2" />

        {/* Zone C - Economy (Far) */}
        {renderParkingSection(
          layout.zoneC.left,
          layout.zoneC.right,
          'zoneC',
          { zone: 'C', description: 'Economy', color: 'bg-gray-600' }
        )}

        {/* Bottom curved section (exit area) */}
        <div className="flex justify-center mt-2">
          <div className="w-80 h-10 border-b-4 border-l-4 border-r-4 border-gray-600/60 rounded-b-full flex items-start justify-center pt-1">
            <div className="flex items-center gap-2 px-4 py-1 bg-wc-dark rounded border border-gray-600">
              <span className="text-wc-red font-bold text-xs tracking-wide">EXIT</span>
              <svg className="w-4 h-4 text-wc-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-400 mt-4 bg-wc-dark/50 rounded-lg px-4 py-2">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-5 rounded-sm bg-green-500 border border-green-600 skew-y-3" />
          <span>Standard</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-5 rounded-sm bg-blue-500 border border-blue-600 skew-y-3" />
          <span>EV Charging</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-5 rounded-sm bg-purple-500 border border-purple-600 skew-y-3" />
          <span>Motorcycle</span>
        </div>
        <div className="w-px h-4 bg-gray-600" />
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-5 rounded-sm bg-red-600/80 border border-red-700 skew-y-3" />
          <span>Occupied</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-5 rounded-sm bg-yellow-400 border border-yellow-300 skew-y-3" />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-5 rounded-sm bg-orange-500/80 border border-orange-600 skew-y-3" />
          <span>Held</span>
        </div>
      </div>
    </div>
  );
}
