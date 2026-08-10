# Optional Blood Group Design

## Goal

Allow donors to register without knowing or providing their blood group while preserving validation for any blood group value that is supplied.

## Public Registration

The blood-group selector on `public/index.html` will no longer be required. Its existing empty option remains the default, and the label will identify the field as optional in both Hindi and English.

Submitting the form with the empty option will send an empty string, which the server will accept.

## Server Validation And Storage

Blood group remains a constrained field when present:

- Empty, missing, or whitespace-only values are accepted.
- Valid blood groups remain `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, and `O-`.
- Any other non-empty value is rejected as `Invalid blood group`.

The cleaning step will normalize empty, missing, and whitespace-only values to `''`. This gives public registration, admin updates, and CSV imports one consistent stored representation.

## Admin Editing

The admin table already renders an empty blood group safely. Edit mode will add a blank `Not provided` option before the eight valid groups.

An administrator can preserve or select the blank value when saving a donor. Existing valid values continue to work unchanged.

## CSV Import And Export

CSV import will no longer require a `Blood Group` header. If the header is absent, imported donors receive `bloodGroup: ''`.

If the header is present:

- Blank cells are accepted and normalized to `''`.
- Valid blood groups are accepted.
- Invalid non-empty values are reported using the existing invalid-row mechanism.

CSV export retains the existing `Blood Group` column for compatibility and writes an empty cell when the donor has no recorded blood group.

## Compatibility

Existing donor records with valid blood groups are unchanged. Existing records with a missing blood-group property are handled as empty values in the public API, admin rendering, editing, and CSV export.

No database migration or new dependency is required.

## Testing

Tests will verify:

- Server validation accepts missing, empty, and whitespace-only blood groups.
- Server validation still rejects invalid non-empty blood groups.
- Cleaning normalizes optional blood-group values to `''`.
- CSV import accepts a missing Blood Group header.
- CSV import accepts a blank Blood Group cell.
- CSV import still rejects an invalid non-empty blood group during row validation.
- The public selector is not required and is labeled optional.
- Admin edit mode contains a blank `Not provided` option.

The existing donor sorting tests and server self-check will remain passing.
