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
export type MetricFlag = 'ok' | 'attention' | 'alert' | 'unclassified';
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
  | 'data_sharing_pharmacy'
  | 'data_sharing_hospital'
  | 'data_sharing_public_health'
  | 'ai_exam_processing'
  | 'research'
  | 'research_academic'
  | 'research_pharma'
  | 'study_invitations'
  | 'marketing';
export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'export'
  | 'print'
  | 'share';
export type PregnancyStatus = 'active' | 'completed' | 'lost' | 'archived';
export type PregnancyRisk = 'habitual' | 'alto';
export type ChildSex = 'male' | 'female';
export type DeliveryType = 'vaginal' | 'cesarean';
export type MilestoneCategory = 'motor' | 'language' | 'social' | 'cognitive';

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
          calendar_token: string;
          calendar_enabled: boolean;
          calendar_token_rotated_at: string | null;
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
        | 'calendar_token'
        | 'calendar_enabled'
        | 'calendar_token_rotated_at'
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
          stock_count: number | null;
          stock_unit: string;
          stock_low_threshold_days: number;
          stock_last_updated_at: string | null;
          package_size: number | null;
          last_stock_alert_at: string | null;
          anvisa_registration: string | null;
          anvisa_drug_name: string | null;
          anvisa_last_checked_at: string | null;
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
        | 'stock_count'
        | 'stock_unit'
        | 'stock_low_threshold_days'
        | 'stock_last_updated_at'
        | 'package_size'
        | 'last_stock_alert_at'
        | 'anvisa_registration'
        | 'anvisa_drug_name'
        | 'anvisa_last_checked_at'
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
          child_id: string | null;
          vaccine_name: string;
          dose_label: string | null;
          applied_at: string | null;
          lot: string | null;
          manufacturer: string | null;
          location: string | null;
          next_dose_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        },
        'id' | 'created_at' | 'updated_at',
        'child_id' | 'dose_label' | 'applied_at' | 'lot' | 'manufacturer' | 'location' | 'next_dose_at' | 'notes'
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
          actor_id: string | null;
          patient_id: string | null;
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
          category_id: string | null;
          tags: string[];
          needs_review: boolean;
          review_reason: string | null;
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
        | 'category_id'
        | 'tags'
        | 'needs_review'
        | 'review_reason'
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
          needs_review: boolean;
          review_reason: string | null;
          created_at: string;
        },
        'id' | 'created_at',
        'is_anonymous' | 'hidden' | 'parent_comment_id' | 'needs_review' | 'review_reason'
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
      pregnancy_journeys: Table<
        {
          id: string;
          user_id: string;
          started_at: string;
          due_date: string | null;
          lmp_date: string | null;
          risk_level: PregnancyRisk | null;
          obstetrician_name: string | null;
          obstetrician_crm: string | null;
          obstetrician_phone: string | null;
          maternity_reference: string | null;
          maternity_phone: string | null;
          status: PregnancyStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        },
        'id' | 'created_at' | 'updated_at' | 'started_at',
        | 'due_date'
        | 'lmp_date'
        | 'risk_level'
        | 'obstetrician_name'
        | 'obstetrician_crm'
        | 'obstetrician_phone'
        | 'maternity_reference'
        | 'maternity_phone'
        | 'status'
        | 'notes'
      >;
      pregnancy_weight_log: Table<
        {
          id: string;
          journey_id: string;
          week: number;
          weight_kg: number;
          recorded_at: string;
        },
        'id' | 'recorded_at'
      >;
      pregnancy_fetal_movements: Table<
        {
          id: string;
          journey_id: string;
          recorded_at: string;
          duration_minutes: number | null;
          movements_count: number | null;
          notes: string | null;
        },
        'id' | 'recorded_at',
        'duration_minutes' | 'movements_count' | 'notes'
      >;
      pregnancy_milestone_catalog: Table<
        {
          code: string;
          label_pt: string;
          trimester: number;
          week_min: number;
          week_max: number;
          category: string;
          description_short: string | null;
          source: string;
        },
        never,
        'category' | 'description_short' | 'source'
      >;
      pregnancy_milestones: Table<
        {
          id: string;
          journey_id: string;
          milestone_code: string;
          planned_at: string | null;
          completed_at: string | null;
          notes: string | null;
          created_at: string;
        },
        'id' | 'created_at',
        'planned_at' | 'completed_at' | 'notes'
      >;
      children: Table<
        {
          id: string;
          parent_profile_id: string;
          full_name: string;
          birth_date: string;
          sex: ChildSex;
          birth_weight_g: number | null;
          birth_length_cm: number | null;
          birth_head_circumference_cm: number | null;
          gestational_age_weeks_at_birth: number | null;
          delivery_type: DeliveryType | null;
          blood_type: BloodType;
          created_at: string;
          updated_at: string;
        },
        'id' | 'created_at' | 'updated_at',
        | 'birth_weight_g'
        | 'birth_length_cm'
        | 'birth_head_circumference_cm'
        | 'gestational_age_weeks_at_birth'
        | 'delivery_type'
        | 'blood_type'
      >;
      child_growth_measurements: Table<
        {
          id: string;
          child_id: string;
          measured_at: string;
          age_months_at_measurement: number;
          weight_kg: number | null;
          length_or_height_cm: number | null;
          head_circumference_cm: number | null;
          bmi: number | null;
          notes: string | null;
          created_at: string;
        },
        'id' | 'created_at' | 'bmi' | 'measured_at',
        'weight_kg' | 'length_or_height_cm' | 'head_circumference_cm' | 'notes'
      >;
      child_milestone_catalog: Table<
        {
          code: string;
          label_pt: string;
          category: MilestoneCategory;
          typical_age_months_min: number;
          typical_age_months_max: number;
          description_short: string | null;
          source: string;
        },
        never,
        'description_short' | 'source'
      >;
      child_milestones: Table<
        {
          id: string;
          child_id: string;
          milestone_code: string;
          achieved_at: string | null;
          notes: string | null;
          created_at: string;
        },
        'id' | 'created_at',
        'achieved_at' | 'notes'
      >;
      child_vaccine_schedule: Table<
        {
          code: string;
          label_pt: string;
          dose_label: string;
          recommended_age_months: number;
          source: string;
        },
        never,
        'source'
      >;
      who_growth_standards: Table<
        {
          indicator: string;
          sex: ChildSex;
          x: number;
          l: number;
          m: number;
          s: number;
          source: string;
        },
        never,
        'source'
      >;
      menstrual_cycle_settings: Table<
        {
          user_id: string;
          tracking_enabled: boolean;
          average_cycle_days: number;
          average_period_days: number;
          contraceptive_method: string | null;
          share_with_caregiver: boolean;
          share_with_doctor: boolean;
          share_with_research: boolean;
          created_at: string;
          updated_at: string;
        },
        'created_at' | 'updated_at',
        | 'tracking_enabled'
        | 'average_cycle_days'
        | 'average_period_days'
        | 'contraceptive_method'
        | 'share_with_caregiver'
        | 'share_with_doctor'
        | 'share_with_research'
      >;
      menstrual_cycle_logs: Table<
        {
          id: string;
          user_id: string;
          log_date: string;
          flow_level: number;
          symptoms: string[];
          mood: string[];
          notes: string | null;
          created_at: string;
        },
        'id' | 'created_at',
        'flow_level' | 'symptoms' | 'mood' | 'notes'
      >;
      notification_queue: Table<
        {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string;
          channel: string;
          resource_type: string | null;
          resource_id: string | null;
          created_at: string;
          sent_at: string | null;
          read_at: string | null;
        },
        'id' | 'created_at',
        'channel' | 'resource_type' | 'resource_id' | 'sent_at' | 'read_at'
      >;
      diary_pain_points: Table<
        {
          id: string;
          diary_entry_id: string;
          user_id: string;
          body_region: string;
          side: string | null;
          intensity: number;
          type: string | null;
          notes: string | null;
          created_at: string;
        },
        'id' | 'created_at',
        'side' | 'type' | 'notes'
      >;
      community_members: Table<
        {
          user_id: string;
          staff_role: string | null;
          professional_badge: string | null;
          professional_registry: string | null;
          professional_verified_at: string | null;
          member_tier: string;
          reputation_points: number;
          community_rules_accepted_at: string | null;
          suspended_until: string | null;
          created_at: string;
          updated_at: string;
        },
        'created_at' | 'updated_at',
        | 'staff_role'
        | 'professional_badge'
        | 'professional_registry'
        | 'professional_verified_at'
        | 'member_tier'
        | 'reputation_points'
        | 'community_rules_accepted_at'
        | 'suspended_until'
      >;
      reputation_events: Table<
        {
          id: string;
          user_id: string;
          event_type: string;
          points: number;
          related_post_id: string | null;
          created_at: string;
        },
        'id' | 'created_at',
        'related_post_id'
      >;
      professional_verifications: Table<
        {
          id: string;
          user_id: string;
          type: string;
          registry_number: string;
          registry_state: string;
          status: string;
          verify_crm_response: Json | null;
          document_path: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          expires_at: string | null;
          created_at: string;
        },
        'id' | 'created_at',
        | 'type'
        | 'status'
        | 'verify_crm_response'
        | 'document_path'
        | 'reviewed_by'
        | 'reviewed_at'
        | 'expires_at'
      >;
      forum_categories: Table<
        {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          icon: string | null;
          sort: number;
          kind: string;
          group_id: string | null;
          disclaimer: string | null;
          created_at: string;
        },
        'id' | 'created_at',
        'description' | 'icon' | 'sort' | 'kind' | 'group_id' | 'disclaimer'
      >;
      useful_marks: Table<
        {
          id: string;
          topic_id: string;
          comment_id: string;
          marked_by: string;
          created_at: string;
        },
        'id' | 'created_at',
        never
      >;
      moderation_actions: Table<
        {
          id: string;
          actor_id: string;
          action:
            | 'hide'
            | 'unhide'
            | 'pin'
            | 'unpin'
            | 'lock'
            | 'unlock'
            | 'move'
            | 'strike'
            | 'suspend';
          target_post_id: string | null;
          target_comment_id: string | null;
          target_user_id: string | null;
          reason: string | null;
          meta: Json | null;
          created_at: string;
        },
        'id' | 'created_at',
        'target_post_id' | 'target_comment_id' | 'target_user_id' | 'reason' | 'meta'
      >;
      user_strikes: Table<
        {
          id: string;
          user_id: string;
          reason: string;
          issued_by: string | null;
          post_id: string | null;
          created_at: string;
          expires_at: string;
        },
        'id' | 'created_at' | 'expires_at',
        'issued_by' | 'post_id'
      >;
      vouchers: Table<
        {
          id: string;
          code: string;
          kind: string;
          duration_days: number;
          max_uses: number;
          uses_count: number;
          created_by: string | null;
          expires_at: string | null;
          active: boolean;
          created_at: string;
        },
        'id' | 'created_at' | 'uses_count',
        'kind' | 'max_uses' | 'created_by' | 'expires_at' | 'active'
      >;
      voucher_redemptions: Table<
        {
          id: string;
          voucher_id: string;
          user_id: string;
          redeemed_at: string;
          expires_at: string;
        },
        'id' | 'redeemed_at',
        never
      >;
      personal_access_tokens: Table<
        {
          id: string;
          user_id: string;
          name: string;
          token_hash: string;
          token_prefix: string;
          scopes: string[];
          last_used_at: string | null;
          expires_at: string | null;
          revoked_at: string | null;
          created_at: string;
        },
        'id' | 'created_at',
        'scopes' | 'last_used_at' | 'expires_at' | 'revoked_at'
      >;
      account_deletion_requests: Table<
        {
          id: string;
          user_id: string | null;
          status: 'requested' | 'in_review' | 'completed' | 'rejected';
          requested_at: string;
          updated_at: string;
          completed_at: string | null;
        },
        'id' | 'requested_at' | 'updated_at',
        'status' | 'completed_at'
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
          author_staff_role: string | null;
          author_professional_badge: string | null;
          author_professional_registry: string | null;
          author_member_tier: string | null;
          author_reputation: number | null;
          category_id: string | null;
          tags: string[];
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
          author_staff_role: string | null;
          author_professional_badge: string | null;
          author_professional_registry: string | null;
          author_member_tier: string | null;
          author_reputation: number | null;
        };
        Relationships: [];
      };
      forum_category_stats: {
        Row: {
          category_id: string;
          slug: string;
          name: string;
          description: string | null;
          icon: string | null;
          sort: number;
          kind: string;
          group_id: string | null;
          topic_count: number;
          last_activity_at: string | null;
        };
        Relationships: [];
      };
      forum_trending_tags: {
        Row: {
          tag: string;
          uses: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      search_forum_topics: {
        Args: { q: string; lim?: number };
        Returns: Database['public']['Views']['feed_posts']['Row'][];
      };
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
      owns_pregnancy_journey: {
        Args: { p_journey: string };
        Returns: boolean;
      };
      start_pregnancy: {
        Args: {
          p_due_date: string | null;
          p_lmp_date?: string | null;
          p_risk?: PregnancyRisk | null;
          p_obstetrician_name?: string | null;
          p_obstetrician_crm?: string | null;
          p_obstetrician_phone?: string | null;
          p_maternity_reference?: string | null;
          p_maternity_phone?: string | null;
        };
        Returns: string;
      };
      can_access_child: {
        Args: { p_child: string };
        Returns: boolean;
      };
      log_child_access: {
        Args: { p_child: string; p_action: AuditAction };
        Returns: undefined;
      };
      medication_days_remaining: {
        Args: { p_med: string };
        Returns: number;
      };
      medication_daily_doses: {
        Args: { p_med: string };
        Returns: number;
      };
      calendar_feed: {
        Args: { p_token: string };
        Returns: {
          id: string;
          doctor_name: string;
          specialty: string | null;
          scheduled_at: string;
          kind: AppointmentKind;
          location: string | null;
        }[];
      };
      set_patient_consent: {
        Args: {
          p_purpose: ConsentPurpose;
          p_granted: boolean;
          p_scope?: Json;
          p_version?: string;
        };
        Returns: Database['public']['Tables']['consents']['Row'];
      };
      can_process_exam_with_ai: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      get_accessible_profile: {
        Args: { p_profile_id: string };
        Returns: Json;
      };
      request_account_deletion: {
        Args: Record<string, never>;
        Returns: Json;
      };
      list_related_profile_names: {
        Args: { p_profile_ids: string[] };
        Returns: { id: string; full_name: string }[];
      };
      owns_child: {
        Args: { p_child: string };
        Returns: boolean;
      };
      is_suspended: {
        Args: { uid: string };
        Returns: boolean;
      };
      mod_hide_post: {
        Args: { p_post_id: string; p_reason: string };
        Returns: undefined;
      };
      mod_unhide_post: {
        Args: { p_post_id: string };
        Returns: undefined;
      };
      mod_set_pinned: {
        Args: { p_post_id: string; p_pinned: boolean };
        Returns: undefined;
      };
      mod_set_locked: {
        Args: { p_post_id: string; p_locked: boolean };
        Returns: undefined;
      };
      mod_move_topic: {
        Args: { p_post_id: string; p_category_id: string };
        Returns: undefined;
      };
      mod_add_strike: {
        Args: { p_user_id: string; p_reason: string; p_post_id?: string | null };
        Returns: undefined;
      };
      accept_community_rules: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      log_self_security_event: {
        Args: { p_resource_type: string; p_metadata?: Json };
        Returns: undefined;
      };
      log_ai_exam_processing: {
        Args: { p_exam_id: string };
        Returns: undefined;
      };
      has_plus_access: {
        Args: { uid?: string };
        Returns: boolean;
      };
      redeem_voucher: {
        Args: { p_code: string };
        Returns: string;
      };
      create_voucher: {
        Args: {
          p_code: string;
          p_kind: string;
          p_duration_days: number;
          p_max_uses: number;
          p_expires_at?: string | null;
        };
        Returns: string;
      };
      has_ai_assistant_access: {
        Args: { uid?: string };
        Returns: boolean;
      };
      api_me_bundle: {
        Args: { p_token_hash: string };
        Returns: Json;
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
      pregnancy_status: PregnancyStatus;
      pregnancy_risk: PregnancyRisk;
      child_sex: ChildSex;
      delivery_type: DeliveryType;
      milestone_category: MilestoneCategory;
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
export type UserReport = Row<'user_reports'>;
export type FeedPost = Database['public']['Views']['feed_posts']['Row'];
export type FeedComment = Database['public']['Views']['feed_comments']['Row'];
export type PregnancyJourney = Row<'pregnancy_journeys'>;
export type PregnancyWeightLog = Row<'pregnancy_weight_log'>;
export type PregnancyFetalMovement = Row<'pregnancy_fetal_movements'>;
export type PregnancyMilestone = Row<'pregnancy_milestones'>;
export type PregnancyMilestoneCatalog = Row<'pregnancy_milestone_catalog'>;
export type Child = Row<'children'>;
export type ChildGrowthMeasurement = Row<'child_growth_measurements'>;
export type ChildMilestone = Row<'child_milestones'>;
export type ChildMilestoneCatalog = Row<'child_milestone_catalog'>;
export type ChildVaccineSchedule = Row<'child_vaccine_schedule'>;
export type WhoGrowthStandard = Row<'who_growth_standards'>;
export type MenstrualCycleSettings = Row<'menstrual_cycle_settings'>;
export type MenstrualCycleLog = Row<'menstrual_cycle_logs'>;
export type NotificationQueueItem = Row<'notification_queue'>;
export type DiaryPainPoint = Row<'diary_pain_points'>;
export type Voucher = Row<'vouchers'>;
export type VoucherRedemption = Row<'voucher_redemptions'>;
export type PersonalAccessToken = Row<'personal_access_tokens'>;
export type CommunityMember = Row<'community_members'>;
export type ReputationEvent = Row<'reputation_events'>;
export type ProfessionalVerification = Row<'professional_verifications'>;
export type ForumCategory = Row<'forum_categories'>;
export type UsefulMark = Row<'useful_marks'>;
export type ModerationAction = Row<'moderation_actions'>;
export type UserStrike = Row<'user_strikes'>;
export type ForumCategoryStat = Database['public']['Views']['forum_category_stats']['Row'];
export type ForumTrendingTag = Database['public']['Views']['forum_trending_tags']['Row'];
