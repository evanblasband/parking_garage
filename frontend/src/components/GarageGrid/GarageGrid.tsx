/**
 * GarageGrid Component
 *
 * Renders a horizontal parking garage visualization with:
 * - 5 horizontal aisles with driving lanes
 * - Perpendicular parking spots (not angled)
 * - Entrance/Exit on the left side
 * - Zone labels (A, B, C) based on distance from entrance
 * - Color-coded spots by type and occupancy status
 *
 * Themed with U.S. Soccer Federation 2025/2026 branding.
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
  price: number
): string {
  // Perpendicular spots - rectangular, compact
  const baseClasses = `w-7 h-5 cursor-pointer transition-all duration-150 flex items-center justify-center text-[8px] font-medium border rounded-sm`;

  if (isSelected) {
    return `${baseClasses} bg-[#d4b380] text-ussf-navy ring-2 ring-[#d4b380] ring-offset-1 ring-offset-white scale-110 z-10 border-[#b8995a]`;
  }

  if (isSpaceOccupied) {
    return `${baseClasses} bg-ussf-red text-white cursor-not-allowed border-ussf-red-dark`;
  }

  if (isSpaceHeld) {
    return `${baseClasses} bg-amber-500 text-white cursor-not-allowed border-amber-600`;
  }

  // Available spots - color by type
  switch (space.type) {
    case 'EV':
      return `${baseClasses} bg-teal-500 hover:bg-teal-400 text-white border-teal-600`;
    case 'MOTORCYCLE':
      return `${baseClasses} bg-violet-500 hover:bg-violet-400 text-white border-violet-600`;
    default:
      // Standard spots - Shades of green based on price
      if (price > 35) {
        return `${baseClasses} bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-800`;
      } else if (price > 25) {
        return `${baseClasses} bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-700`;
      } else if (price > 15) {
        return `${baseClasses} bg-emerald-500 hover:bg-emerald-400 text-white border-emerald-600`;
      }
      return `${baseClasses} bg-emerald-400 hover:bg-emerald-300 text-ussf-navy border-emerald-500`;
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
      {icon && <span className="text-[8px]">{icon}</span>}
      {isOccupied && !icon && <span className="text-[6px]">●</span>}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export function GarageGrid() {
  const { state, send, dispatch } = useGarage();
  const { garageState, prices, selectedSpaceId } = state;

  // Build parking layout: 5 horizontal aisles, each with 2 rows of 10 spots
  const aisles = useMemo(() => {
    if (!garageState) return [];

    // Group spaces into 5 aisles (rows 0-1, 2-3, 4-5, 6-7, 8-9)
    const aisleData: { topRow: Space[]; bottomRow: Space[] }[] = [];

    for (let aisle = 0; aisle < 5; aisle++) {
      const topRowIdx = aisle * 2;
      const bottomRowIdx = aisle * 2 + 1;

      const topRow = garageState.spaces
        .filter((s) => s.row === topRowIdx)
        .sort((a, b) => a.col - b.col);
      const bottomRow = garageState.spaces
        .filter((s) => s.row === bottomRowIdx)
        .sort((a, b) => a.col - b.col);

      aisleData.push({ topRow, bottomRow });
    }

    return aisleData;
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

  const renderSpaceRow = (spaces: Space[]) => {
    if (!garageState) return null;

    // Group spaces by zone
    const zoneA = spaces.filter(s => s.col <= 2);
    const zoneB = spaces.filter(s => s.col >= 3 && s.col <= 6);
    const zoneC = spaces.filter(s => s.col >= 7);

    const renderZoneSpaces = (zoneSpaces: Space[]) => (
      <div className="flex gap-0.5">
        {zoneSpaces.map((space) => {
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
            />
          );
        })}
      </div>
    );

    return (
      <div className="flex">
        {/* Zone A */}
        <div className="bg-red-50/50 px-1">
          {renderZoneSpaces(zoneA)}
        </div>
        {/* Zone divider */}
        <div className="w-px bg-gray-300 mx-0.5" />
        {/* Zone B */}
        <div className="bg-blue-50/50 px-1">
          {renderZoneSpaces(zoneB)}
        </div>
        {/* Zone divider */}
        <div className="w-px bg-gray-300 mx-0.5" />
        {/* Zone C */}
        <div className="bg-gray-100/50 px-1">
          {renderZoneSpaces(zoneC)}
        </div>
      </div>
    );
  };

  if (!garageState) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-ussf-text-muted">Loading garage...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-2 text-[9px] text-ussf-text bg-white rounded-md shadow px-3 py-1.5 border border-gray-200">
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm bg-emerald-500 border border-emerald-600" />
          <span className="font-medium">Standard</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm bg-teal-500 border border-teal-600" />
          <span className="font-medium">EV</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm bg-violet-500 border border-violet-600" />
          <span className="font-medium">Moto</span>
        </div>
        <div className="w-px h-3 bg-gray-300" />
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm bg-ussf-red border border-ussf-red-dark" />
          <span className="font-medium">Occupied</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm bg-[#d4b380] border border-[#b8995a]" />
          <span className="font-medium">Selected</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm bg-amber-500 border border-amber-600" />
          <span className="font-medium">Held</span>
        </div>
      </div>

      {/* Main Garage Container */}
      <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-md flex gap-2">
        {/* Entrance/Exit on left side */}
        <div className="flex flex-col justify-center gap-2 pr-2 border-r border-gray-300">
          <div className="flex items-center gap-1 px-2 py-1 bg-ussf-navy rounded text-white">
            <span className="text-[8px] font-bold">IN</span>
            <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-ussf-red rounded text-white">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-[8px] font-bold">OUT</span>
          </div>
        </div>

        {/* Parking Aisles */}
        <div className="flex flex-col gap-1">
          {/* Zone labels at top - using same structure as spot rows */}
          <div className="flex">
            {/* Zone A label - 3 spots wide */}
            <div className="bg-red-50/50 px-1 flex justify-center items-center relative">
              <div className="flex gap-0.5 invisible">
                {[0,1,2].map(i => <div key={i} className="w-7 h-4" />)}
              </div>
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="px-1.5 py-0.5 bg-ussf-red text-white text-[7px] font-bold rounded">
                  A - Premium
                </span>
              </span>
            </div>
            <div className="w-px bg-gray-300 mx-0.5" />
            {/* Zone B label - 4 spots wide */}
            <div className="bg-blue-50/50 px-1 flex justify-center items-center relative">
              <div className="flex gap-0.5 invisible">
                {[0,1,2,3].map(i => <div key={i} className="w-7 h-4" />)}
              </div>
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="px-1.5 py-0.5 bg-ussf-navy text-white text-[7px] font-bold rounded">
                  B - Standard
                </span>
              </span>
            </div>
            <div className="w-px bg-gray-300 mx-0.5" />
            {/* Zone C label - 3 spots wide */}
            <div className="bg-gray-100/50 px-1 flex justify-center items-center relative">
              <div className="flex gap-0.5 invisible">
                {[0,1,2].map(i => <div key={i} className="w-7 h-4" />)}
              </div>
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="px-1.5 py-0.5 bg-gray-500 text-white text-[7px] font-bold rounded">
                  C - Economy
                </span>
              </span>
            </div>
          </div>

          {/* Aisles */}
          {aisles.map((aisle, aisleIdx) => (
            <div key={aisleIdx} className="flex flex-col">
              {/* Top row of spots */}
              {renderSpaceRow(aisle.topRow)}

              {/* Driving lane with zone backgrounds - using same width structure */}
              <div className="flex my-0.5">
                {/* Zone A lane - 3 spots wide */}
                <div className="bg-red-100/50 px-1 h-3 flex items-center">
                  <div className="flex gap-0.5">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-7 flex items-center justify-center">
                        <div className="w-full h-0.5 bg-yellow-400 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="w-px bg-gray-300 mx-0.5" />
                {/* Zone B lane - 4 spots wide */}
                <div className="bg-blue-100/50 px-1 h-3 flex items-center">
                  <div className="flex gap-0.5">
                    {[0,1,2,3].map(i => (
                      <div key={i} className="w-7 flex items-center justify-center">
                        <div className="w-full h-0.5 bg-yellow-400 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="w-px bg-gray-300 mx-0.5" />
                {/* Zone C lane - 3 spots wide */}
                <div className="bg-gray-200/50 px-1 h-3 flex items-center">
                  <div className="flex gap-0.5">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-7 flex items-center justify-center">
                        <div className="w-full h-0.5 bg-yellow-400 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom row of spots */}
              {renderSpaceRow(aisle.bottomRow)}

              {/* Aisle separator (except for last aisle) */}
              {aisleIdx < aisles.length - 1 && (
                <div className="flex my-1">
                  {/* Zone A separator */}
                  <div className="bg-red-50/50 px-1">
                    <div className="flex gap-0.5">
                      {[0,1,2].map(i => <div key={i} className="w-7 h-0.5 bg-red-200/50" />)}
                    </div>
                  </div>
                  <div className="w-px bg-gray-300 mx-0.5" />
                  {/* Zone B separator */}
                  <div className="bg-blue-50/50 px-1">
                    <div className="flex gap-0.5">
                      {[0,1,2,3].map(i => <div key={i} className="w-7 h-0.5 bg-blue-200/50" />)}
                    </div>
                  </div>
                  <div className="w-px bg-gray-300 mx-0.5" />
                  {/* Zone C separator */}
                  <div className="bg-gray-100/50 px-1">
                    <div className="flex gap-0.5">
                      {[0,1,2].map(i => <div key={i} className="w-7 h-0.5 bg-gray-300/50" />)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
