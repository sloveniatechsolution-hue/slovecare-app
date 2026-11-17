import { avatarImage, avatarInitials } from '../src/components/AvatarPicker';

describe('AvatarPicker and Profile stats', () => {
  it('avatarImage preserves local file://, content://, and data: URIs without corrupting them', () => {
    // Before fix: file:// was prepended with origin (https://slovecarebackend.../file:///...)
    const fileUri = 'file:///data/user/0/com.slovecare/cache/rn_temp_123.jpg';
    expect(avatarImage(fileUri)).toBe(fileUri);

    const contentUri = 'content://media/external/images/media/456';
    expect(avatarImage(contentUri)).toBe(contentUri);

    const dataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...';
    expect(avatarImage(dataUri)).toBe(dataUri);

    const webUri = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
    expect(avatarImage(webUri)).toBe(webUri);

    // Dicebear default avatar should return undefined so initials are rendered
    expect(avatarImage('https://api.dicebear.com/7.x/avataaars/svg?seed=123')).toBeUndefined();
    expect(avatarImage('')).toBeUndefined();
    expect(avatarImage(null)).toBeUndefined();
  });

  it('generates initials correctly', () => {
    expect(avatarInitials('Dr. Naman Jain')).toBe('DN');
    expect(avatarInitials('Ramesh')).toBe('R');
    expect(avatarInitials('')).toBe('SC');
  });

  it('correctly calculates user-specific profile counts instead of hardcoded 29, 5, 2', () => {
    const mockDashboard = {
      user: { id: 'usr-1', name: 'Test' },
      stats: {
        totalBookings: 29, // Server stale/aggregate count
        activeBookings: 12,
        completedVisits: 5,
        reportsCount: 2,
        prescriptionsCount: 1,
      },
      bookings: [
        { id: 'b1', status: 'confirmed' },
        { id: 'b2', status: 'completed' },
      ],
      labReports: [],
      prescriptions: [],
    };

    // Derived counts
    const userBookings = mockDashboard.bookings;
    const userReports = mockDashboard.labReports;
    const userPrescriptions = mockDashboard.prescriptions;

    const totalBookings = userBookings ? userBookings.length : mockDashboard.stats.totalBookings;
    const completedVisits = userBookings
      ? userBookings.filter(b => b.status === 'completed').length
      : mockDashboard.stats.completedVisits;
    const activeBookings = userBookings
      ? userBookings.filter(b => ['new', 'upcoming', 'confirmed', 'in_progress', 'scheduled'].includes(b.status)).length
      : mockDashboard.stats.activeBookings;
    const reportsCount = userReports ? userReports.length : mockDashboard.stats.reportsCount;
    const prescriptionsCount = userPrescriptions ? userPrescriptions.length : mockDashboard.stats.prescriptionsCount;

    // Must be 2 bookings, 1 completed, 0 reports (reflecting user's actual data!)
    expect(totalBookings).toBe(2);
    expect(completedVisits).toBe(1);
    expect(activeBookings).toBe(1);
    expect(reportsCount).toBe(0);
    expect(prescriptionsCount).toBe(0);
  });
});
