// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { VersionItem } from '../ui/VersionItem';

afterEach(() => {
  cleanup();
});

describe('VersionItem', () => {
  describe('when no update is available', () => {
    it('renders the current version with v prefix', () => {
      render(<VersionItem version="1.2.3" latestVersion={null} />);
      expect(screen.getByText('v1.2.3')).toBeDefined();
    });

    it('does not render an update indicator', () => {
      render(<VersionItem version="1.2.3" latestVersion={null} />);
      expect(screen.queryByText(/↑/)).toBeNull();
    });

    it('sets aria-label to current version', () => {
      render(<VersionItem version="1.2.3" latestVersion={null} />);
      const button = screen.getByRole('button', { name: 'Version 1.2.3' });
      expect(button).toBeDefined();
    });

    it('does not show tooltip on click', () => {
      render(<VersionItem version="1.2.3" latestVersion={null} />);
      const button = screen.getByRole('button', { name: 'Version 1.2.3' });
      fireEvent.click(button);
      expect(screen.queryByRole('tooltip')).toBeNull();
    });
  });

  describe('when an update is available', () => {
    it('renders the latest version with update indicator', () => {
      render(<VersionItem version="1.2.3" latestVersion="1.3.0" />);
      expect(screen.getByText('↑ v1.3.0')).toBeDefined();
    });

    it('does not render the current version text', () => {
      render(<VersionItem version="1.2.3" latestVersion="1.3.0" />);
      expect(screen.queryByText('v1.2.3')).toBeNull();
    });

    it('sets aria-label to update available message', () => {
      render(<VersionItem version="1.2.3" latestVersion="1.3.0" />);
      const button = screen.getByRole('button', { name: 'Update available: v1.3.0' });
      expect(button).toBeDefined();
    });

    it('shows tooltip with update instructions on click', () => {
      render(<VersionItem version="1.2.3" latestVersion="1.3.0" />);
      const button = screen.getByRole('button', { name: 'Update available: v1.3.0' });
      fireEvent.click(button);
      expect(screen.getByRole('tooltip')).toBeDefined();
    });

    it('tooltip contains npm update command', () => {
      render(<VersionItem version="1.2.3" latestVersion="1.3.0" />);
      fireEvent.click(screen.getByRole('button', { name: 'Update available: v1.3.0' }));
      expect(screen.getByText('npm update -g dorkos')).toBeDefined();
    });

    it('tooltip shows version transition', () => {
      render(<VersionItem version="1.2.3" latestVersion="1.3.0" />);
      fireEvent.click(screen.getByRole('button', { name: 'Update available: v1.3.0' }));
      expect(screen.getByText(/Update available: v1\.2\.3 → v1\.3\.0/)).toBeDefined();
    });

    it('toggles tooltip off on second click', () => {
      render(<VersionItem version="1.2.3" latestVersion="1.3.0" />);
      const button = screen.getByRole('button', { name: 'Update available: v1.3.0' });
      fireEvent.click(button);
      expect(screen.getByRole('tooltip')).toBeDefined();
      fireEvent.click(button);
      expect(screen.queryByRole('tooltip')).toBeNull();
    });
  });

  describe('when latestVersion equals current version', () => {
    it('renders current version (no update) when versions are equal', () => {
      render(<VersionItem version="1.2.3" latestVersion="1.2.3" />);
      expect(screen.getByText('v1.2.3')).toBeDefined();
      expect(screen.queryByText(/↑/)).toBeNull();
    });
  });

  describe('when latestVersion is older than current version', () => {
    it('renders current version (no update) when latest is behind', () => {
      render(<VersionItem version="2.0.0" latestVersion="1.9.9" />);
      expect(screen.getByText('v2.0.0')).toBeDefined();
      expect(screen.queryByText(/↑/)).toBeNull();
    });
  });

  describe('isNewer semver logic', () => {
    it('detects major version bump as update', () => {
      render(<VersionItem version="1.0.0" latestVersion="2.0.0" />);
      expect(screen.getByText('↑ v2.0.0')).toBeDefined();
    });

    it('detects minor version bump as update', () => {
      render(<VersionItem version="1.2.0" latestVersion="1.3.0" />);
      expect(screen.getByText('↑ v1.3.0')).toBeDefined();
    });

    it('detects patch version bump as update', () => {
      render(<VersionItem version="1.2.3" latestVersion="1.2.4" />);
      expect(screen.getByText('↑ v1.2.4')).toBeDefined();
    });

    it('does not treat lower major as update', () => {
      render(<VersionItem version="2.0.0" latestVersion="1.99.99" />);
      expect(screen.getByText('v2.0.0')).toBeDefined();
    });

    it('does not treat lower minor as update', () => {
      render(<VersionItem version="1.5.0" latestVersion="1.4.99" />);
      expect(screen.getByText('v1.5.0')).toBeDefined();
    });

    it('does not treat lower patch as update', () => {
      render(<VersionItem version="1.2.5" latestVersion="1.2.4" />);
      expect(screen.getByText('v1.2.5')).toBeDefined();
    });
  });
});
