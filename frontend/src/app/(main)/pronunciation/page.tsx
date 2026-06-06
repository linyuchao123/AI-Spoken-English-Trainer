import { Target, TrendingUp } from "lucide-react";

export default function PronunciationPage() {
  return (
    <div className="max-w-3xl mx-auto py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#5B4FCF]/10 to-[#7C6FF7]/10 flex items-center justify-center mx-auto mb-6">
        <Target className="w-8 h-8 text-[#5B4FCF]" />
      </div>
      <h1 className="text-2xl font-extrabold text-text-primary mb-2">
        发音评测分析
      </h1>
      <p className="text-text-secondary text-sm mb-8 max-w-md mx-auto leading-relaxed">
        详细的发音评分与音标纠错，将在这里呈现。
        包括整体评分、准确度、流利度、完整度等维度分析。
      </p>
      <div className="bg-white rounded-2xl border border-border p-8 inline-block">
        <TrendingUp className="w-10 h-10 text-text-light/40 mx-auto mb-3" />
        <p className="text-text-light text-sm">
          📈 发音评测详细功能将在后续版本中实现
        </p>
        <p className="text-text-light/60 text-xs mt-2">
          开始练习后，你的发音评分数据将在这里汇总展示
        </p>
      </div>
    </div>
  );
}
