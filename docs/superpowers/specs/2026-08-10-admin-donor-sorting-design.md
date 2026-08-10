# Admin Donor Sorting Design

## Goal

Add a sorting control to the admin donor table. The table must show the latest registrations first by default and allow the administrator to switch to oldest-first or name A-Z ordering.

## User Interface

Add a compact `select` control beside the existing search field with these options:

- Latest first
- Oldest first
- Name A-Z

`Latest first` is selected when the page loads. Changing the selection updates the visible table immediately without another network request.

## Data Flow

The existing `/api/donors` response includes each donor's `createdAt` value. The admin page will:

1. Load donors once.
2. Filter donors using the existing search query.
3. Sort the filtered result using the selected ordering.
4. Render the sorted rows and update the visible donor count.

The `/api/donors` endpoint will also default to `{ createdAt: -1, _id: -1 }` ordering so the API's natural order is latest-first. The `_id` tie-breaker provides deterministic ordering for entries with equal timestamps.

## Sorting Rules

- Latest first: descending `createdAt`.
- Oldest first: ascending `createdAt`.
- Name A-Z: locale-aware ascending comparison by `name`.
- Entries with a missing or invalid `createdAt` value appear after entries with valid timestamps in both date-based modes.
- Entries with equal timestamps retain deterministic order using their identifiers.

## Scope

This change only affects the admin donor list and the default ordering of the admin donors API. CSV export ordering remains unchanged because the request concerns the admin page display.

## Error Handling

The existing load and authentication behavior remains unchanged. Sorting operates on the already-loaded array, so changing the sort does not introduce new network failure states.

## Testing

Add a focused, dependency-free sorting helper test that verifies:

- Latest-first ordering.
- Oldest-first ordering.
- Name A-Z ordering.
- Missing timestamps appear last.

Run the existing server self-check and the new sorting checks before completion.
