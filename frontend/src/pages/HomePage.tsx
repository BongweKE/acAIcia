import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ExternalLink,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useSettings } from '../context/SettingsContext';

const suggestedQuestions = [
  "What are the best agroforestry practices for soil nitrogen fixation?",
  "How does climate change impact maize yield in East Africa?",
  "Compare organic vs synthetic fertilizer environmental footprints",
  "Explain integrated pest management for coffee rust disease",
];

function Citation({
  number,
  title,
  journal,
  year,
}: {
  number: string;
  title: string;
  journal: string;
  year: string;
}) {
  return (
    <Link
      to="/assistant"
      className="group flex gap-3 border-t border-border py-4 first:border-t-0 hover:bg-muted/50 px-2 rounded-md transition-colors"
    >
      <span className="font-mono text-[10px] text-accent font-semibold">{number}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-5 transition-colors group-hover:text-accent">
          {title}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {journal} · {year}
        </span>
      </span>
      <ExternalLink className="ml-auto mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-accent" />
    </Link>
  );
}

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { submitUserQuery, isProcessing, currentStage, messages, pills } = useChat();
  const { activeModelName } = useSettings();

  const [question, setQuestion] = useState("");
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const activePills = pills && pills.length > 0 ? pills : suggestedQuestions;

  const handleAskQuestion = async (textToSubmit?: string) => {
    const queryToRun = (textToSubmit || question).trim();
    if (!queryToRun || isProcessing) return;
    
    // Submit query to context and navigate to Assistant view
    await submitUserQuery(queryToRun);
    setQuestion("");
    navigate('/assistant');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleAskQuestion();
    }
  };

  const chooseSuggestion = (suggestion: string) => {
    setQuestion(suggestion);
    handleAskQuestion(suggestion);
  };

  return (
    <main className="min-h-screen bg-background font-sans text-foreground">
      {/* HERO SECTION */}
      <section id="assistant" className="relative overflow-hidden bg-primary text-primary-foreground">
        {/* Decorative elements matching mockup */}
        <div className="absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full border border-sidebar-border/60 pointer-events-none" />
        <div className="absolute -right-20 top-20 h-72 w-72 rounded-full border border-accent/40 pointer-events-none" />
        <div className="absolute bottom-12 right-12 hidden h-20 w-20 rotate-12 rounded-lg bg-chart-3/90 pointer-events-none lg:block" />
        <div className="absolute bottom-10 right-40 hidden h-12 w-12 rounded-full bg-chart-2/90 pointer-events-none lg:block" />

        <div className="relative mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-end">
            {/* Hero Left Content */}
            <div className="max-w-2xl">
              <div className="acaicia-fade-up flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-accent font-semibold">
                <span className="h-px w-8 bg-accent" />
                Powered by CIFOR & ICRAF
              </div>
              <h1 className="acaicia-fade-up acaicia-fade-up-delay-1 mt-6 max-w-2xl font-serif text-5xl font-medium leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-[5.5rem]">
                Ask better questions. Find evidence you can use.
              </h1>
              <p className="acaicia-fade-up acaicia-fade-up-delay-2 mt-7 max-w-xl text-lg leading-8 text-primary-foreground/75">
                acAIcia helps you navigate agricultural research, crop science, agroforestry, soil health, and sustainable farming practices.
              </p>
            </div>

            {/* Hero Right Input Card */}
            <div className="acaicia-fade-up acaicia-fade-up-delay-3 rounded-xl bg-card p-5 text-card-foreground shadow-2xl sm:p-6 border border-border">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent font-semibold">
                    acAIcia Assistant
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Evidence-backed answers for your next decision.
                  </p>
                </div>
                <div className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  Powered by {activeModelName}
                </div>
              </div>

              <div className="mt-5">
                <label htmlFor="question" className="sr-only">
                  Ask a research question
                </label>
                <textarea
                  id="question"
                  rows={4}
                  className="w-full resize-none rounded-lg border border-input bg-background p-4 text-sm text-foreground shadow-inner focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="e.g. What are the nitrogen fixation rates of shade-grown legumes in agroforestry systems?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                />

                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span className="hidden sm:inline">
                    Press <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘</kbd> + <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd> to submit
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAskQuestion()}
                    disabled={!question.trim() || isProcessing}
                    className="ml-auto inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow transition-colors hover:bg-accent/90 disabled:opacity-50"
                  >
                    {isProcessing ? 'Thinking...' : 'Ask acAIcia'} <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Prompt Pills */}
              <div className="mt-5 border-t border-border pt-4">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Suggested Prompts:
                </div>
                <div className="flex flex-col gap-2">
                  {activePills.slice(0, 3).map((pill, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => chooseSuggestion(pill)}
                      className="group text-left text-xs text-muted-foreground transition-colors hover:text-foreground flex items-center justify-between py-1"
                    >
                      <span className="line-clamp-1">"{pill}"</span>
                      <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 shrink-0 text-accent ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAMPLE ANSWER / RECENT DEMO SECTION */}
      <section id="answer" className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
        <div className="flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent font-semibold">
              Research Synthesis Example
            </div>
            <h2 className="mt-3 font-serif text-3xl font-medium tracking-[-0.03em] sm:text-4xl">
              Agroforestry & Soil Health Synthesis
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-accent" /> Peer-reviewed evidence
            </span>
          </div>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6 text-base leading-7">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
                <span className="font-mono text-xs font-semibold text-accent">Synthesis Result</span>
                <span className="text-xs text-muted-foreground">Model: {activeModelName}</span>
              </div>
              <div className="mt-4 space-y-4 text-sm leading-6 text-foreground">
                <p>
                  Integrating nitrogen-fixing leguminous trees (such as <em>Gliricidia sepium</em> and <em>Leucaena leucocephala</em>) into agroforestry systems enhances soil organic carbon stocks by an average of <strong>27% to 42%</strong> over a 5-year rotation period <span className="font-semibold text-accent">[Hoang et al., 2010]</span>.
                </p>
                <p>
                  In East African smallholder maize farming, alley cropping with leguminous species provided an equivalent of <strong>60-90 kg N/ha/year</strong>, significantly reducing dependence on synthetic inorganic fertilizers while improving water retention during seasonal droughts <span className="font-semibold text-accent">[CIFOR-ICRAF Brief, 2021]</span>.
                </p>
              </div>

              {/* Feedback buttons */}
              <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
                <span>Was this response helpful?</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFeedback('up')}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                      feedback === 'up' ? 'bg-accent/10 text-accent font-semibold' : 'hover:bg-muted'
                    }`}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" /> Helpful
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedback('down')}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                      feedback === 'down' ? 'bg-destructive/10 text-destructive font-semibold' : 'hover:bg-muted'
                    }`}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" /> Needs work
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Citations sidebar */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <BookOpen className="h-4 w-4 text-accent" /> Retrieved Publications (2)
            </h3>
            <div className="mt-4">
              <Citation
                number="[01]"
                title="Nitrogen fixation dynamics in tropical agroforestry systems"
                journal="Agroforestry Systems Journal"
                year="2010"
              />
              <Citation
                number="[02]"
                title="Soil organic carbon sequestration in smallholder maize farming"
                journal="CIFOR-ICRAF Technical Policy Brief"
                year="2021"
              />
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section id="how-it-works" className="bg-muted/40 border-y border-border py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent font-semibold">
                How it works
              </div>
              <h2 className="mt-3 font-serif text-4xl font-medium tracking-[-0.035em] sm:text-5xl">
                Built for rigorous, evidence-first exploration.
              </h2>
            </div>
            <p className="max-w-md text-sm text-muted-foreground">
              Designed specifically for forestry researchers, agronomists, soil scientists, and policy practitioners.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-7 shadow-sm transition-all hover:border-accent/50">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/10 text-accent">
                <Search className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">1. Search & Retrieval</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Scans Landscape Alliance peer-reviewed publications and internal technical briefs using hybrid dense-vector embeddings and full-text keyword indexing.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-7 shadow-sm transition-all hover:border-accent/50">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/10 text-accent">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">2. AI Synthesis</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Generates concise, structured answers that highlight consensus, contextual variations, and research gaps directly relevant to your field questions.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-7 shadow-sm transition-all hover:border-accent/50">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/10 text-accent">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">3. Transparent Citations</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Every major claim includes inline [Author, Year] citations linked directly to original DOIs and publication URLs for complete verification.
              </p>
            </div>
          </div>

          {/* Suggested Questions Grid */}
          <div className="mt-16">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent font-semibold">
                  Sample Prompts
                </div>
                <h3 className="mt-2 font-serif text-2xl font-medium tracking-tight sm:text-3xl">
                  Explore common agriscience questions
                </h3>
              </div>
              <Link
                to="/assistant"
                className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                Browse all in Assistant <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
              </Link>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {suggestedQuestions.slice(2).map((suggestion, index) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => chooseSuggestion(suggestion)}
                  className="group flex items-start gap-4 rounded-xl border border-border bg-card p-6 text-left shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:border-accent/40"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
                    {String(index + 3).padStart(2, "0")}
                  </span>
                  <span className="text-sm font-medium leading-6 transition-colors group-hover:text-accent">
                    {suggestion}
                  </span>
                  <ArrowRight className="ml-auto mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-accent" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT SECTION */}
      <section id="about" className="bg-primary text-primary-foreground py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:px-10">
          <div>
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-accent font-semibold">
              <span className="h-px w-8 bg-accent" />
              About Landscape Alliance
            </div>
            <h2 className="mt-5 max-w-3xl font-serif text-4xl font-medium leading-[1.02] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
              Transforming science into global action.
            </h2>
          </div>

          <div>
            <p className="text-base leading-7 text-primary-foreground/75">
              Landscape Alliance transforms science into action, unlocking the power of trees, forests and agroforestry landscapes to advance planetary health and human well-being. By 2035, Landscape Alliance is committed to measurable, global-scale outcomes for climate, biodiversity, restoration, resilient livelihoods and agroforestry transformation. These commitments are grounded in science, data, partnerships and implementation experience.
            </p>
            <div className="mt-7 flex flex-wrap gap-4">
              <a
                href="https://www.landscapealliance.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-secondary px-5 py-2.5 text-sm font-semibold text-secondary-foreground shadow transition-colors hover:bg-secondary/90"
              >
                Learn more <ExternalLink className="h-4 w-4" />
              </a>
              <Link
                to="/about"
                className="inline-flex items-center gap-2 rounded-md border border-primary-foreground/20 px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
              >
                Learn about the acAIcia project
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};
