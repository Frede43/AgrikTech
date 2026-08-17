import type { LucideIcon } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";

export interface GuideSection {
  id: string;
  icon: LucideIcon;
  title: string;
  summary: string;
  content: React.ReactNode;
}

interface GuideSectionsProps {
  sections: GuideSection[];
}

export function GuideSections({ sections }: GuideSectionsProps) {
  return (
    <Card className="max-w-4xl">
      <CardContent className="p-0">
        <Accordion type="single" collapsible className="px-4 md:px-6">
          {sections.map((section) => (
            <AccordionItem key={section.id} value={section.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <section.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{section.title}</p>
                    <p className="mt-0.5 text-xs font-normal text-muted-foreground">{section.summary}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pl-14 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
                  {section.content}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
