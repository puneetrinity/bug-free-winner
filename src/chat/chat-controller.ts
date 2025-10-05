import db from '../db/connection';
import { ReportGenerator } from '../reports/generator';
import { QueryAnalyzer } from './query-analyzer';
import { ChatEvent } from '../types/chat';

export class ChatController {
  private reportGenerator: ReportGenerator;
  private queryAnalyzer: QueryAnalyzer;

  constructor() {
    try {
      this.reportGenerator = new ReportGenerator();
      this.queryAnalyzer = new QueryAnalyzer();
    } catch (error) {
      console.error('❌ ChatController initialization error:', error);
      throw error;
    }
  }

  async *handleMessage(sessionId: string, userMessage: string): AsyncGenerator<ChatEvent> {
    try {
      console.log(`💬 Processing message in session ${sessionId}: "${userMessage.substring(0, 50)}..."`);

      // 1. Save user message to database
      await db.insertChatMessage({
        session_id: sessionId,
        role: 'user',
        content: userMessage
      });

      // 2. Analyze query with LLM
      yield {
        type: 'status',
        stage: 'analyzing_query',
        message: 'Understanding your research question...'
      };

      const analysis = await this.queryAnalyzer.analyze(userMessage);

      // Update session title if it's the first message or generic
      try {
        const session = await db.getChatSession(sessionId);
        if (session && (session.title === 'New Research' || !session.title)) {
          const title = analysis.topic.substring(0, 100);
          await db.updateChatSessionTitle(sessionId, title);
        }
      } catch (titleError) {
        console.warn('Could not update session title:', titleError);
      }

      // Send analysis details
      yield {
        type: 'content',
        content: `I'll research **${analysis.topic}** using up to ${analysis.max_sources} sources from the past ${analysis.time_range_days} days.\n\n${analysis.focus_areas.length > 0 ? `**Focus areas:** ${analysis.focus_areas.join(', ')}` : ''}`
      };

      // 3. Start research with progress updates
      yield {
        type: 'status',
        stage: 'searching',
        message: 'Searching for relevant sources...',
        percentage: 20
      };

      // Generate report
      const result = await this.reportGenerator.generateReport(
        analysis.topic,
        analysis.max_sources,
        analysis.time_range_days
      );

      if (!result.success || !result.report) {
        throw new Error(result.error || 'Report generation failed');
      }

      const report = result.report;

      console.log(`✅ Report generated: ${report.id} with ${report.source_count} sources`);

      // 4. Provide progress updates during synthesis
      yield {
        type: 'status',
        stage: 'synthesizing',
        message: `Analyzing ${report.source_count} sources...`,
        percentage: 80
      };

      // 5. Stream report summary with markdown formatting
      const formattedSummary = this.formatReportSummary(report);

      yield {
        type: 'content',
        content: formattedSummary
      };

      // 6. Send complete report data
      yield {
        type: 'report_complete',
        stage: 'complete',
        report: {
          id: report.id,
          title: report.title,
          confidence_score: report.confidence_score,
          source_count: report.source_count,
          citation_count: report.citation_count,
          word_count: report.word_count,
          pdf_path: report.pdf_path,
          created_at: report.created_at
        },
        message: `Research complete! Found ${report.source_count} sources with ${report.citation_count} citations. Confidence: ${((report.confidence_score || 0) * 100).toFixed(0)}%`,
        percentage: 100
      };

      // 7. Save assistant message with report reference
      await db.insertChatMessage({
        session_id: sessionId,
        role: 'assistant',
        content: report.executive_summary || formattedSummary,
        report_id: report.id,
        metadata: {
          analysis,
          report_stats: {
            source_count: report.source_count,
            citation_count: report.citation_count,
            confidence_score: report.confidence_score
          }
        }
      });

    } catch (error) {
      console.error('💥 Chat error:', error);

      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

      yield {
        type: 'error',
        message: `I encountered an error while researching: ${errorMessage}. Please try again or rephrase your question.`
      };

      // Save error message
      try {
        await db.insertChatMessage({
          session_id: sessionId,
          role: 'assistant',
          content: `Error: ${errorMessage}`,
          metadata: { error: true, error_message: errorMessage }
        });
      } catch (dbError) {
        console.error('Could not save error message:', dbError);
      }
    }
  }

  private formatReportSummary(report: any): string {
    const summary = report.executive_summary || 'No summary available.';

    return `## Research Complete! 🎉

${summary}

---

**Research Statistics:**
- 📊 **Sources Analyzed:** ${report.source_count}
- 📝 **Citations:** ${report.citation_count}
- 📖 **Word Count:** ${report.word_count.toLocaleString()}
- 🎯 **Confidence Score:** ${((report.confidence_score || 0) * 100).toFixed(0)}%
${report.pdf_path ? '- 📄 **PDF Available:** Yes' : ''}

You can download the full report below.`;
  }
}
