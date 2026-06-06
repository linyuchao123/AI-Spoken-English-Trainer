import { Wrench, BookOpen } from "lucide-react";

export default function GrammarPage() {
  return (
    <div className="max-w-3xl mx-auto py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#C8956C]/10 to-[#E0B894]/10 flex items-center justify-center mx-auto mb-6">
        <Wrench className="w-8 h-8 text-[#C8956C]" />
      </div>
      <h1 className="text-2xl font-extrabold text-text-primary mb-2">
        语法与表达纠错
      </h1>
      <p className="text-text-secondary text-sm mb-8 max-w-md mx-auto leading-relaxed">
        你的语法错误与纠正建议，将在这里汇总展示。
        包括语法类型、词汇用法、句子结构等维度分析。
      </p>
      <div className="bg-white rounded-2xl border border-border p-8 inline-block">
        <BookOpen className="w-10 h-10 text-text-light/40 mx-auto mb-3" />
        <p className="text-text-light text-sm">
          🛠 语法纠错详细汇总将在后续版本中实现
        </p>
        <p className="text-text-light/60 text-xs mt-2">
          开始练习后，AI将对你的语法错误进行实时纠正并在此汇总
        </p>
      </div>
    </div>
  );
}
