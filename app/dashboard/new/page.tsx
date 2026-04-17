import { createNewMeeting } from '@/lib/meetings/create-meeting'

export default async function NewMeetingPage() {
  await createNewMeeting()
}
