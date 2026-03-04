import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function LandingCta() {
    return (
        <section className="border-t border-border px-6 py-20 md:px-12">
            <div className="mx-auto flex max-w-md flex-col items-center gap-6 text-center">
                <h2 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                    Ready to get started?
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                    Turn your next meeting into structured, searchable notes in minutes.
                </p>
                <Button asChild size="lg">
                    <Link href="/auth/sign-up">
                        Start for free
                    </Link>
                </Button>
            </div>
        </section>
    )
}
