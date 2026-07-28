import NominationDetailClient from "./nominationDetailClient"

interface Props {
  params: Promise<{ pollId: string }>
}

export default async function NominationPollDetailPage({ params }: Props) {
  const { pollId } = await params
  return <NominationDetailClient pollId={pollId} />
}
