import { BarChart3, FileText } from "lucide-react";

export default function ReportPage() {
  return (
    <div className="max-w-3xl mx-auto py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#22C55E]/10 to-[#4ADE80]/10 flex items-center justify-center mx-auto mb-6">
        <BarChart3 className="w-8 h-8 text-[#22C55E]" />
      </div>
      <h1 className="text-2xl font-extrabold text-text-primary mb-2">
        Learning Report
      </h1>
      <p className="text-text-secondary text-sm mb-8 max-w-md mx-auto leading-relaxed">
        Your session summary and performance analysis.
        Pronunciation trends, error analysis charts, and AI-generated improvement suggestions.
      </p>
      <div className="bg-white rounded-2xl border border-border p-8 inline-block">
        <FileText className="w-10 h-10 text-text-light/40 mx-auto mb-3" />
        <p className="text-text-light text-sm">
          📈 课后报告详细功能将在后续版本中实现
        </p>
        <p className="text-text-light/60 text-xs mt-2">
          包含发音趋势图、错误分析图表和AI学习建议
        </p>
      </div>
    </div>
  );
}
