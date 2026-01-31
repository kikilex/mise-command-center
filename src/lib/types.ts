export type BusinessRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface BusinessMember {
  id: string;
  business_id: string;
  user_id: string;
  role: BusinessRole;
  invited_at: string;
  accepted_at: string | null;
  user?: { email: string; full_name: string; };
}

export interface InviteMemberData {
  email: string;
  role: BusinessRole;
}