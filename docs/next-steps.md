# RK Fitness - Next Steps

Current status:
- Stable React/Vite app shell is working.
- Trainee booking flow exists as a local UI demo.
- Trainee workout logging flow exists as a local UI demo.
- Database is not connected yet, so booking requests and submitted workouts are not persisted across users/devices.

Next recommended steps:

1. Add local confirmation states
   - Booking submit should show a success message after clicking submit.
   - Workout submit should show a success message after clicking submit.
   - Use local React state only for now.

2. Improve trainee progress page
   - Weekly completion: completed workouts vs weekly target.
   - Consistency percentage.
   - Recent improvement notes.
   - Last submitted workout summary.

3. Improve admin Today screen
   - Booking requests waiting for approval.
   - Workouts waiting for review.
   - Leads requiring follow-up.
   - Package renewal reminders.

4. Later backend phase
   - Add Supabase project.
   - Add trainees table.
   - Add workouts table.
   - Add booking_requests table.
   - Add storage bucket for video uploads and payment proofs.

Development rule:
- Keep each change small and stable.
- Do not rewrite the whole App.jsx at once.
- Test locally after every change.
