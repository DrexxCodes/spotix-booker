import NominationSettingsClient from "./settingsClient"

interface Props {
  params: Promise<{ pollId: string }>
}

export default async function NominationSettingsPage({ params }: Props) {
  const { pollId } = await params
  return <NominationSettingsClient pollId={pollId} />
}
