/**
 * Tipos do banco — espelham `supabase/migrations/0001_init.sql`.
 *
 * Mantido à mão por ora (fonte única para web + mobile). Quando o Supabase CLI
 * estiver configurado, pode ser substituído por:
 *   supabase gen types typescript --local > packages/core/src/types/db.ts
 * preservando o nome do export `Database`.
 */

// ---- Enums (espelham os CREATE TYPE da migration) ----
export type BiologicalSex = 'female' | 'male' | 'intersex' | 'unspecified';
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown';
export type CareRelationshipKind = 'family' | 'caregiver' | 'doctor' | 'lab';
export type CareStatus = 'pending' | 'accepted' | 'revoked';
export type VitalType =
  | 'blood_pressure'
  | 'glucose'
  | 'weight'
  | 'heart_rate'
  | 'temperature'
  | 'oxygen_saturation';
export type MedicationForm =
  | 'tablet'
  | 'capsule'
  | 'liquid'
  | 'injection'
  | 'drops'
  | 'inhaler'
  | 'cream'
  | 'other';
export type MedicationFrequency = 'daily' | 'weekly' | 'as_needed';
export type IntakeStatus = 'pending' | 'taken' | 'skipped';
export type ExamStatus = 'uploaded' | 'processing' | 'processed';
export type MetricFlag = 'ok' | 'attention' | 'alert';
export type ConditionStatus = 'active' | 'controlled' | 'resolved' | 'suspected';
export type AllergySeverity = 'mild' | 'moderate' | 'severe';
export type AppointmentKind = 'in_person' | 'telehealth';
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';
export type FamilyRelationship = 'mother' | 'father' | 'sibling' | 'grandparent' | 'child' | 'other';
export type InteractionSeverity = 'minor' | 'moderate' | 'major';
export type ExamCategory = 'lab' | 'imaging' | 'cardio';
export type CaregiverInviteRole = 'i_am_caregiver' | 'i_am_patient';
export type ConsentPurpose =
  | 'data_sharing_family'
  | 'data_sharing_doctor'
  | 'data_sharing_lab'
  | 'data_sharing_insurance'
  | 'research'
  | 'marketing';
export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'export'
  | 'print'
  | 'share';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// Helper para montar Row/Insert/Update reduzindo boilerplate.
type Table<Row, Insertable extends keyof Row, Optional extends keyof Row = never> = {
  Row: Row;
  Insert: Omit<Row, Insertable | Optional> & Partial<Pick<Row, Insertable | Optional>>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  // Marcador exigido pelas versões recentes do supabase-js para inferir
  // corretamente os tipos de insert/update (PostgREST 12).
  __InternalSupabase: {
    PostgrestVersion: '12';
  };
  public: {
    Tables: {
      profiles: Table<
        {
          id: string;
          full_name: string;
          date_of_birth: string | null;
          biological_sex: BiologicalSex;
          blood_type: BloodType;
          phone: string | null;
          cpf: string | null;
          address: Json;
          height_cm: number | null;
          guardian_id: string | null;
          is_minor: boolean;
          emergency_note: string | null;
          deleted_at: string | null;
          deletion_scheduled_at: string | null;
          created_at: string;
          updated_at: string;
        },
        'created_at' | 'updated_at',
        | 'biological_sex'
        | 'blood_type'
        | 'is_minor'
        | 'date_of_birth'
        | 'phone'
        | 'cpf'
        | 'address'
        | 'height_cm'
        | 'guardian_id'
        | 'emergency_note'
        | 'deleted_at'
        | 'deletion_scheduled_at'
      >;
      care_relationships: Table<
        {
          id: string;
          patient_id: string;
          caregiver_id: string;
          kind: CareRelationshipKind;
          status: CareStatus;
          permissions: Json;
          invited_at: string;
          accepted_at: string | null;
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
        },
        'id' | 'created_at' | 'updated_at' | 'invited_at',
        'kind' | 'status' | 'permissions' | 'accepted_at' | 'revoked_at'
      >;
      diary_entries: Table<
        {
          id: string;
          patient_id: string;
          entry_date: string;
          mood: number | null;
          energy: number | null;
          pain: number | null;
          symptoms: string[];
          note: string | null;
          created_at: string;
          updated_at: string;
        },
        'id' | 'created_at' | 'updated_at',
        'entry_date' | 'mood' | 'energy' | 'pain' | 'symptoms' | 'note'
      >;
      vitals: Table<
        {
          id: string;
          patient_id: string;
          type: VitalType;
          measured_at: string;
          value_primary: number;
          value_secondary: number | null;
          unit: string;
          note: string | null;
          created_at: string;
        },
        'id' | 'created_at',
        'measured_at' | 'value_secondary' | 'note'
      >;
      medications: Table<
        {
          id: string;
          patient_id: string;
          name: string;
          dosage: string | null;
          form: MedicationForm;
          frequency: MedicationFrequency;
          times: string[];
          unit: string | null;
          prescriber: string | null;
          active: boolean;
          started_at: string | null;
          ended_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        },
        'id' | 'created_at' | 'updated_at',
        | 'dosage'
        | 'form'
        | 'frequency'
        | 'times'
        | 'unit'
        | 'prescriber'
        | 'active'
        | 'started_at'
        | 'ended_at'
        | 'notes'
      >;
      medication_schedules: Table<
        {
          id: string;
          medication_id: string;
          patient_id: string;
          frequency: MedicationFrequency;
          times: string[];
          days_of_week: number[];
          reminder_enabled: boolean;
          start_date: string;
          end_date: string | null;
          created_at: string;
          updated_at: string;
        },
        'id' | 'created_at' | 'updated_at',
        'frequency' | 'times' | 'days_of_week' | 'reminder_enabled' | 'start_date' | 'end_date'
      >;
      medication_intakes: Table<
        {
          id: string;
          medication_id: string;
          schedule_id: string | null;
          patient_id: string;
          scheduled_for: string | null;
          taken_at: string | null;
          status: IntakeStatus;
          note: string | null;
          skip_reason: string | null;
          created_at: string;
        },
        'id' | 'created_at',
        'schedule_id' | 'scheduled_for' | 'taken_at' | 'status' | 'note' | 'skip_reason'
      >;
      exams: Table<
        {
          id: string;
          patient_id: string;
          title: string;
          exam_type: string | null;
          category: ExamCategory;
          exam_date: string | null;
          storage_path: string | null;
          file_mime: string | null;
          lab_name: string | null;
          doctor_name: string | null;
          doctor_crm: string | null;
          raw_text: string | null;
          status: ExamStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        },
        'id' | 'created_at' | 'updated_at',
        | 'exam_type'
        | 'category'
        | 'exam_date'
        | 'storage_path'
        | 'file_mime'
        | 'lab_name'
        | 'doctor_name'
        | 'doctor_crm'
        | 'raw_text'
        | 'status'
        | 'notes'
      >;
      exam_metrics: Table<
        {
          id: string;
          exam_id: string;
          patient_id: string;
          name: string;
          metric_code: string | null;
          value: number | null;
          value_text: string | null;
          unit: string | null;
          reference_min: number | null;
          reference_max: number | null;
          flag: MetricFlag;
          measured_at: string | null;
          created_at: string;
        },
        'id' | 'created_at',
        | 'metric_code'
        | 'value'
        | 'value_text'
        | 'unit'
        | 'reference_min'
        | 'reference_max'
        | 'flag'
        | 'measured_at'
      >;
      conditions: Table<
        {
          id: string;
          patient_id: string;
          cid10_code: string | null;
          name: string;
          status: ConditionStatus;
          diagnosed_at: string | null;
          resolved_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        },
        'id' | 'created_at' | 'updated_at',
        'cid10_code' | 'status' | 'diagnosed_at' | 'resolved_at' | 'notes'
      >;
      vaccinations: Table<
        {
          id: string;
          patient_id: string;
          vaccine_name: string;
          dose_label: string | null;
          applied_at: string | null;
          lot: string | null;
          location: string | null;
          next_dose_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        },
        'id' | 'created_at' | 'updated_at',
        'dose_label' | 'applied_at' | 'lot' | 'location' | 'next_dose_at' | 'notes'
      >;
      consents: Table<
        {
          id: string;
          patient_id: string;
          purpose: ConsentPurpose;
          scope: Json;
          granted: boolean;
          version: string;
          granted_at: string | null;
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
        },
        'id' | 'created_at' | 'updated_at',
        'scope' | 'granted' | 'version' | 'granted_at' | 'revoked_at'
      >;
      audit_log: Table<
        {
          id: string;
          actor_id: string;
          patient_id: string;
          action: AuditAction;
          resource_type: string;
          resource_id: string | null;
          ip_address: string | null;
          metadata: Json;
          created_at: string;
        },
        'id' | 'created_at',
        'resource_id' | 'ip_address' | 'metadata'
      >;
      appointments: Table<
        {
          id: string;
          patient_id: string;
          doctor_name: string;
          doctor_crm: string | null;
          specialty: string | null;
          scheduled_at: string;
          kind: AppointmentKind;
          status: AppointmentStatus;
          location: string | null;
          meeting_link: string | null;
          reminders: number[];
          exam_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        },
        'id' | 'created_at' | 'updated_at',
        | 'doctor_crm'
        | 'specialty'
        | 'kind'
        | 'status'
        | 'location'
        | 'meeting_link'
        | 'reminders'
        | 'exam_id'
        | 'notes'
      >;
      allergies: Table<
        {
          id: string;
          patient_id: string;
          substance: string;
          severity: AllergySeverity;
          reaction: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        },
        'id' | 'created_at' | 'updated_at',
        'severity' | 'reaction' | 'notes'
      >;
      surgeries: Table<
        {
          id: string;
          patient_id: string;
          procedure: string;
          performed_at: string | null;
          hospital: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        },
        'id' | 'created_at' | 'updated_at',
        'performed_at' | 'hospital' | 'notes'
      >;
      family_history: Table<
        {
          id: string;
          patient_id: string;
          condition: string;
          relationship: FamilyRelationship;
          notes: string | null;
          created_at: string;
          updated_at: string;
        },
        'id' | 'created_at' | 'updated_at',
        'relationship' | 'notes'
      >;
      insurance_plans: Table<
        {
          id: string;
          patient_id: string;
          operator: string;
          card_number: string | null;
          valid_until: string | null;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        },
        'id' | 'created_at' | 'updated_at',
        'card_number' | 'valid_until' | 'is_primary'
      >;
      drug_interactions: Table<
        {
          id: string;
          drug_a: string;
          drug_b: string;
          severity: InteractionSeverity;
          description: string;
          created_at: string;
        },
        'id' | 'created_at',
        'severity'
      >;
      exam_metric_explanations: Table<
        {
          id: string;
          metric_key: string;
          metric_name: string;
          category: ExamCategory;
          what_measures: string;
          why_matters: string;
          low_means: string | null;
          high_means: string | null;
          actions_low: string | null;
          actions_high: string | null;
          created_at: string;
        },
        'id' | 'created_at',
        'category' | 'low_means' | 'high_means' | 'actions_low' | 'actions_high'
      >;
      user_settings: Table<
        {
          user_id: string;
          theme: string;
          locale: string;
          notif_push: boolean;
          notif_email: boolean;
          notif_whatsapp: boolean;
          quiet_hours_start: string | null;
          quiet_hours_end: string | null;
          updated_at: string;
        },
        'updated_at',
        | 'theme'
        | 'locale'
        | 'notif_push'
        | 'notif_email'
        | 'notif_whatsapp'
        | 'quiet_hours_start'
        | 'quiet_hours_end'
      >;
      health_content: Table<
        {
          id: string;
          title: string;
          body: string;
          tags: string[];
          reading_minutes: number;
          source: string;
          source_url: string | null;
          created_at: string;
        },
        'id' | 'created_at',
        'tags' | 'reading_minutes' | 'source_url'
      >;
      reading_list: Table<
        {
          user_id: string;
          content_id: string;
          created_at: string;
        },
        'created_at',
        never
      >;
      caregiver_invites: Table<
        {
          id: string;
          inviter_id: string;
          inviter_name: string | null;
          invitee_email: string;
          role: CaregiverInviteRole;
          kind: CareRelationshipKind;
          permissions: Json;
          token: string;
          expires_at: string;
          status: string;
          accepted_at: string | null;
          created_at: string;
        },
        'id' | 'created_at' | 'expires_at',
        'inviter_name' | 'role' | 'kind' | 'permissions' | 'status' | 'accepted_at'
      >;
      community_groups: Table<
        {
          id: string;
          cid10_code: string | null;
          name: string;
          description: string | null;
          created_at: string;
        },
        'id' | 'created_at',
        'cid10_code' | 'description'
      >;
      group_members: Table<
        { group_id: string; user_id: string; created_at: string },
        'created_at',
        never
      >;
      social_profiles: Table<
        {
          user_id: string;
          display_name: string | null;
          bio: string | null;
          is_public: boolean;
          show_achievements: boolean;
          verified_crm: boolean;
          crm: string | null;
          created_at: string;
          updated_at: string;
        },
        'created_at' | 'updated_at',
        'display_name' | 'bio' | 'is_public' | 'show_achievements' | 'verified_crm' | 'crm'
      >;
      posts: Table<
        {
          id: string;
          group_id: string | null;
          author_id: string;
          is_anonymous: boolean;
          content: string;
          flair: string | null;
          is_achievement: boolean;
          hidden: boolean;
          title: string | null;
          is_pinned: boolean;
          is_locked: boolean;
          is_solved: boolean;
          best_comment_id: string | null;
          reply_count: number;
          last_activity_at: string;
          created_at: string;
        },
        'id' | 'created_at' | 'reply_count' | 'last_activity_at',
        | 'group_id'
        | 'is_anonymous'
        | 'flair'
        | 'is_achievement'
        | 'hidden'
        | 'title'
        | 'is_pinned'
        | 'is_locked'
        | 'is_solved'
        | 'best_comment_id'
      >;
      post_reactions: Table<
        { id: string; post_id: string; user_id: string; emoji: string; created_at: string },
        'id' | 'created_at',
        never
      >;
      post_comments: Table<
        {
          id: string;
          post_id: string;
          author_id: string;
          is_anonymous: boolean;
          content: string;
          hidden: boolean;
          parent_comment_id: string | null;
          created_at: string;
        },
        'id' | 'created_at',
        'is_anonymous' | 'hidden' | 'parent_comment_id'
      >;
      polls: Table<
        { id: string; post_id: string; question: string; options: string[] },
        'id',
        never
      >;
      poll_votes: Table<
        { poll_id: string; user_id: string; option_index: number; created_at: string },
        'created_at',
        never
      >;
      user_connections: Table<
        { follower_id: string; following_id: string; created_at: string },
        'created_at',
        never
      >;
      user_reports: Table<
        {
          id: string;
          reporter_id: string;
          post_id: string | null;
          comment_id: string | null;
          reason: string;
          created_at: string;
        },
        'id' | 'created_at',
        'post_id' | 'comment_id'
      >;
      thread_follows: Table<
        { post_id: string; user_id: string; created_at: string },
        'created_at',
        never
      >;
    };
    Views: {
      feed_posts: {
        Row: {
          id: string;
          group_id: string | null;
          content: string;
          flair: string | null;
          is_achievement: boolean;
          is_anonymous: boolean;
          created_at: string;
          author_id: string | null;
          author_display: string;
          author_verified: boolean;
          title: string | null;
          reply_count: number;
          last_activity_at: string;
          is_solved: boolean;
          is_pinned: boolean;
          best_comment_id: string | null;
          is_locked: boolean;
        };
        Relationships: [];
      };
      feed_comments: {
        Row: {
          id: string;
          post_id: string;
          content: string;
          is_anonymous: boolean;
          created_at: string;
          author_id: string | null;
          author_display: string;
          parent_comment_id: string | null;
          author_verified: boolean;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_accepted_caregiver: {
        Args: { target_patient: string };
        Returns: boolean;
      };
      can_view_patient: {
        Args: { target_patient: string };
        Returns: boolean;
      };
      caregiver_has_permission: {
        Args: { target_patient: string; perm: string };
        Returns: boolean;
      };
      accept_caregiver_invite: {
        Args: { invite_token: string };
        Returns: string;
      };
    };
    Enums: {
      biological_sex: BiologicalSex;
      blood_type: BloodType;
      care_relationship_kind: CareRelationshipKind;
      care_status: CareStatus;
      vital_type: VitalType;
      medication_form: MedicationForm;
      medication_frequency: MedicationFrequency;
      intake_status: IntakeStatus;
      exam_status: ExamStatus;
      metric_flag: MetricFlag;
      condition_status: ConditionStatus;
      allergy_severity: AllergySeverity;
      appointment_kind: AppointmentKind;
      appointment_status: AppointmentStatus;
      family_relationship: FamilyRelationship;
      interaction_severity: InteractionSeverity;
      exam_category: ExamCategory;
      consent_purpose: ConsentPurpose;
      audit_action: AuditAction;
    };
    CompositeTypes: { [_ in never]: never };
  };
}

// ---- Atalhos de tipo por tabela (Row/Insert/Update) ----
type PublicTables = Database['public']['Tables'];
export type Row<T extends keyof PublicTables> = PublicTables[T]['Row'];
export type InsertRow<T extends keyof PublicTables> = PublicTables[T]['Insert'];
export type UpdateRow<T extends keyof PublicTables> = PublicTables[T]['Update'];

export type Profile = Row<'profiles'>;
export type CareRelationship = Row<'care_relationships'>;
export type DiaryEntry = Row<'diary_entries'>;
export type Vital = Row<'vitals'>;
export type Medication = Row<'medications'>;
export type MedicationSchedule = Row<'medication_schedules'>;
export type MedicationIntake = Row<'medication_intakes'>;
export type Exam = Row<'exams'>;
export type ExamMetric = Row<'exam_metrics'>;
export type Condition = Row<'conditions'>;
export type Vaccination = Row<'vaccinations'>;
export type Consent = Row<'consents'>;
export type AuditLogEntry = Row<'audit_log'>;
export type Appointment = Row<'appointments'>;
export type Allergy = Row<'allergies'>;
export type Surgery = Row<'surgeries'>;
export type FamilyHistory = Row<'family_history'>;
export type InsurancePlan = Row<'insurance_plans'>;
export type DrugInteraction = Row<'drug_interactions'>;
export type ExamMetricExplanation = Row<'exam_metric_explanations'>;
export type UserSettings = Row<'user_settings'>;
export type HealthContent = Row<'health_content'>;
export type ReadingListItem = Row<'reading_list'>;
export type CaregiverInvite = Row<'caregiver_invites'>;
export type CommunityGroup = Row<'community_groups'>;
export type SocialProfile = Row<'social_profiles'>;
export type Post = Row<'posts'>;
export type PostReaction = Row<'post_reactions'>;
export type PostComment = Row<'post_comments'>;
export type Poll = Row<'polls'>;
export type PollVote = Row<'poll_votes'>;
export type UserConnection = Row<'user_connections'>;
export type FeedPost = Database['public']['Views']['feed_posts']['Row'];
export type FeedComment = Database['public']['Views']['feed_comments']['Row'];
