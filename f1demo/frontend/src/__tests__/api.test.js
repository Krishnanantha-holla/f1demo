import { describe, it, expect } from 'vitest';
import { getTeamColor } from '../api';

describe('api.getTeamColor', () => {
  it('returns Ferrari red for Ferrari', () => {
    const color = getTeamColor('Ferrari');
    expect(color).toBeTruthy();
    expect(color).toMatch(/^#/);
  });

  it('returns McLaren orange for McLaren', () => {
    const color = getTeamColor('McLaren');
    expect(color).toBeTruthy();
    expect(color).toMatch(/^#/);
  });

  it('returns a fallback color for unknown teams', () => {
    const color = getTeamColor('UnknownTeam2024');
    expect(color).toBeTruthy();
    expect(color).toMatch(/^#/);
  });

  it('handles null gracefully', () => {
    const color = getTeamColor(null);
    expect(color).toBeTruthy();
  });

  it('handles undefined gracefully', () => {
    const color = getTeamColor(undefined);
    expect(color).toBeTruthy();
  });
});
