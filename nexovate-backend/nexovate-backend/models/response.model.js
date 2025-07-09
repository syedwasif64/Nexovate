/**
 * Conceptual Response Schema:
 * Table: UserResponses
 * Columns:
 * - ResponseID: INT, PK
 * - UserID: INT, FK -> Users
 * - QuestionID: INT, FK -> Questions
 * - SelectedOptionID: INT, nullable
 * - CustomText: NVARCHAR, nullable
 * - CreatedAt: DATETIME
 * - UpdatedAt: DATETIME
 * - IsFinalized: BIT (from questionnaire locking)
 *
 * Notes:
 * - Only one of SelectedOptionID or CustomText should have a value.
 * - Responses are locked after finalization (IsFinalized=1).
 */
