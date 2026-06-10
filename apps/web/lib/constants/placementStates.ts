export const PlacementStatus = {
  DRAFT: 'DRAFT',
  PENDING_MATCH: 'PENDING_MATCH',
  PENDING_INSTITUTION: 'PENDING_INSTITUTION',
  PENDING_ORG_APPROVAL: 'PENDING_ORG_APPROVAL',
  ORG_APPROVED: 'ORG_APPROVED',
  ANALYZING: 'ANALYZING',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  APPROVED: 'APPROVED',
  PENDING_COORDINATOR: 'PENDING_COORDINATOR',
  ACTIVE: 'ACTIVE',
  EVALUATION: 'EVALUATION',
  CLOSED: 'CLOSED',
  FINAL_EXAM: 'FINAL_EXAM',
  REJECTED: 'REJECTED'
} as const;

export type PlacementStatusType = typeof PlacementStatus[keyof typeof PlacementStatus];

export const PLACEMENT_STATUS_LABELS: Record<string, string> = {
  [PlacementStatus.DRAFT]: 'Koncept',
  [PlacementStatus.PENDING_MATCH]: 'Čeká na spárování',
  [PlacementStatus.PENDING_INSTITUTION]: 'Čeká na instituci',
  [PlacementStatus.PENDING_ORG_APPROVAL]: 'Čeká na schválení organizací',
  [PlacementStatus.ORG_APPROVED]: 'Schváleno organizací',
  [PlacementStatus.ANALYZING]: 'Analyzuje se',
  [PlacementStatus.NEEDS_REVIEW]: 'Vyžaduje kontrolu',
  [PlacementStatus.APPROVED]: 'Smlouva schválena',
  [PlacementStatus.PENDING_COORDINATOR]: 'Čeká na koordinátora',
  [PlacementStatus.ACTIVE]: 'Aktivní',
  [PlacementStatus.EVALUATION]: 'Hodnocení',
  [PlacementStatus.CLOSED]: 'Uzavřeno',
  [PlacementStatus.FINAL_EXAM]: 'Závěrečná zkouška',
  [PlacementStatus.REJECTED]: 'Zamítnuto',
};

export const COORDINATOR_VIEW_GROUPS: Record<string, string[]> = {
  ACTION_REQUIRED: [
    PlacementStatus.PENDING_MATCH,
    PlacementStatus.NEEDS_REVIEW,
    PlacementStatus.PENDING_COORDINATOR,
    PlacementStatus.PENDING_ORG_APPROVAL // Important! Placed in action required
  ],
  WAITING_ON_OTHERS: [
    PlacementStatus.PENDING_INSTITUTION,
    PlacementStatus.ORG_APPROVED,
    PlacementStatus.ANALYZING
  ],
  APPROVED_ACTIVE: [
    PlacementStatus.APPROVED,
    PlacementStatus.ACTIVE
  ],
  COMPLETED: [
    PlacementStatus.EVALUATION,
    PlacementStatus.CLOSED,
    PlacementStatus.FINAL_EXAM
  ]
};
