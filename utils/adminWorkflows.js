/**
 * Static copy for Admin Guide workflow modules. English operational text only.
 */

export const CORE_FLOW_STEPS = [
  { key: 'availability', label: 'Create availability', emphasis: false },
  { key: 'books', label: 'Customer books + pays', emphasis: false },
  { key: 'assign-coach', label: 'Assign coach', emphasis: true, warning: true },
  { key: 'confirmed', label: 'Coach + customer confirmed', emphasis: false, complete: true },
];

export const ADMIN_WORKFLOWS = [
  {
    id: 'availability',
    number: '01',
    title: 'Create Availability',
    description: 'Create the times that customers are able to book.',
    steps: [
      'Admin creates availability',
      'Date, time, service and location become available',
      'Customer sees the session',
      'Customer can book',
    ],
    action: {
      label: 'Go to Availability',
      screen: 'admin-availability',
    },
    helpLabel: 'How availability works',
  },
  {
    id: 'assign-lesson',
    number: '02',
    title: 'Manually Assign a Lesson',
    description: "Use this when you need to place a lesson directly onto a customer's account.",
    steps: [
      'Admin selects customer',
      'Selects service, date/time and location',
      'Assigns lesson',
      'Lesson appears on customer dashboard',
    ],
    action: {
      label: 'Assign a lesson',
      screen: 'admin-dashboard',
      params: { openAssignLesson: true },
    },
    helpLabel: 'How manual assignments work',
  },
  {
    id: 'new-booking',
    number: '03',
    title: 'New Customer Booking',
    description: 'A coach must be assigned after a customer books.',
    prominent: true,
    steps: [
      'Customer books',
      'Payment taken upfront',
      'Murphey receives SMS',
      'Coach must be assigned',
      'Murphey logs into Admin',
      'Opens Coach Assignments',
      'Assigns coach',
      'Coach receives SMS',
      'Customer receives confirmation',
    ],
    warningStepIndex: 3,
    callout: {
      title: 'Important',
      intro: 'Customer bookings require a coach assignment.',
      bullets: [
        'Murphey receives an SMS.',
        'Open Coach Assignments.',
        'Assign the appropriate coach.',
        'The coach receives an SMS.',
        'The customer receives confirmation.',
      ],
    },
    action: {
      label: 'View Coach Assignments',
      screen: 'admin-coach-assignments',
    },
    helpLabel: 'How coach assignments work',
  },
  {
    id: 'rain-check',
    number: '04',
    title: 'Rain Check',
    description: 'Use Rain Check when a lesson cannot proceed.',
    steps: [
      'Rain Check selected',
      'Booking cancelled',
      'Customer refunded',
      'Booking / availability state updates',
    ],
    note: 'Rain Check can be initiated by Admin or Coach.',
    helpLabel: 'How Rain Check works',
  },
];

export const GUIDE_SECTION_IDS = ADMIN_WORKFLOWS.map((w) => w.id);
