import { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Target, Brain, Zap, CheckCircle, Loader2 } from 'lucide-react';
import { 
  getSwimmerPerformanceTimeline, 
  getCoachingFeedbackPatterns, 
  type PerformanceTimeline, 
  type CoachingPatterns 
} from '../../services/intelligenceService';

interface IntelligenceAnalysisProps {
  swimmerId: string;
}

export default function IntelligenceAnalysis({ swimmerId }: IntelligenceAnalysisProps) {
  const [timeline, setTimeline] = useState<PerformanceTimeline | null>(null);
  const [patterns, setPatterns] = useState<CoachingPatterns | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch both analyses concurrently
        const [timelineData, patternsData] = await Promise.all([
          getSwimmerPerformanceTimeline(swimmerId, 90),
          getCoachingFeedbackPatterns(swimmerId)
        ]);

        setTimeline(timelineData);
        setPatterns(patternsData);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [swimmerId]);

  if (loading) {
    return (
      <div className="bg-background-card backdrop-blur-sm border border-border rounded-2xl p-8 shadow-lg">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-text-secondary">Analyzing performance data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-background-card backdrop-blur-sm border border-border rounded-2xl p-8 shadow-lg">
        <div className="flex items-center gap-3 text-danger">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'improving':
        return <TrendingDown className="w-4 h-4 text-success" />; // Down arrow = faster times = improvement
      case 'declining':
        return <TrendingUp className="w-4 h-4 text-danger" />; // Up arrow = slower times = decline
      default:
        return <Target className="w-4 h-4 text-text-secondary" />;
    }
  };

  const getPerformanceChangeStyle = (improvementRate: number) => {
    // Swimming Performance Logic:
    // Positive improvement_rate = improvement (faster times) = GREEN
    // Negative improvement_rate = decline (slower times) = RED
    if (improvementRate > 0) {
      return 'text-success'; // Green for improvement (faster)
    } else if (improvementRate < 0) {
      return 'text-danger'; // Red for decline (slower)
    }
    return 'text-text-secondary'; // Neutral for no change
  };

  const formatPerformanceChange = (improvementRate: number) => {
    // Backend now sends positive values for improvement (faster times)
    const displayValue = Math.abs(improvementRate);
    const isImprovement = improvementRate > 0;
    
    return {
      value: displayValue.toFixed(1),
      label: isImprovement ? 'faster' : 'slower',
      sign: isImprovement ? '↓' : '↑' // Down arrow for faster (better), up arrow for slower (worse)
    };
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'text-success';
      case 'moderate':
        return 'text-warning';
      default:
        return 'text-text-secondary';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-500">
      {/* Header */}
      <div className="bg-linear-to-r from-primary/10 via-accent/10 to-primary/10 border border-primary/20 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold text-text-primary">AI Performance Intelligence</h2>
        </div>
        <p className="text-text-secondary">
          Advanced analytics powered by machine learning to identify patterns, predict performance, and generate actionable insights.
        </p>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Performance Trends */}
        {timeline && (
          <div className="flex-1 bg-background-card backdrop-blur-sm border border-border rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-text-primary">Performance Trends</h3>
            </div>

            <div className="space-y-4">
              {/* Stroke Analysis */}
              <div>
                <h4 className="text-sm font-medium text-text-secondary mb-3">Stroke Analysis</h4>
                <div className="space-y-2">
                  {Object.entries(timeline.stroke_trends).map(([stroke, data]) => {
                    const changeInfo = formatPerformanceChange(data.improvement_rate_percent);
                    return (
                      <div key={stroke} className="flex items-center justify-between p-3 bg-background-primary rounded-lg">
                        <div className="flex items-center gap-3">
                          {getTrendIcon(data.trend_direction)}
                          <span className="font-medium text-text-primary capitalize">{stroke}</span>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-semibold flex items-center gap-1 justify-end ${getPerformanceChangeStyle(data.improvement_rate_percent)}`}>
                            <span>{changeInfo.sign}</span>
                            <span>{changeInfo.value}%</span>
                            <span className="text-xs ml-1">{changeInfo.label}</span>
                          </div>
                          <div className="text-xs text-text-secondary">
                            {data.data_points} sessions
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Plateau Detection */}
              {Object.keys(timeline.plateau_analysis).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-text-secondary mb-3">Plateau Detection</h4>
                  <div className="space-y-2">
                    {Object.entries(timeline.plateau_analysis).map(([key, plateau]) => (
                      <div key={key} className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-text-primary">
                              {plateau.stroke} {plateau.distance}m
                            </span>
                            <div className="text-xs text-text-secondary">
                              {plateau.plateau_duration_sessions} sessions
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-warning">
                              {(plateau.confidence * 100).toFixed(0)}%
                            </div>
                            <div className="text-xs text-text-secondary">confidence</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Coaching Intelligence */}
        {patterns && (
          <div className="flex-1 bg-background-card backdrop-blur-sm border border-border rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-semibold text-text-primary">Training Session Intelligence</h3>
            </div>
            <div className="text-xs text-text-secondary mb-4 italic">
              Analysis based on training sessions attended and coaching feedback from those sessions
            </div>

            <div className="space-y-4">
              {/* Session Coaching Themes */}
              {patterns.coaching_focus_areas && (
                <div>
                  <h4 className="text-sm font-medium text-text-secondary mb-3">Session Coaching Themes</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between p-2 bg-background-primary rounded">
                      <span className="text-text-primary">Technique Focus:</span>
                      <span className="font-medium text-text-primary">{patterns.coaching_focus_areas.technique_focus_frequency} sessions</span>
                    </div>
                    <div className="flex justify-between p-2 bg-background-primary rounded">
                      <span className="text-text-primary">Endurance Focus:</span>
                      <span className="font-medium text-text-primary">{patterns.coaching_focus_areas.endurance_focus_frequency} sessions</span>
                    </div>
                    <div className="flex justify-between p-2 bg-background-primary rounded">
                      <span className="text-text-primary">Speed Focus:</span>
                      <span className="font-medium text-text-primary">{patterns.coaching_focus_areas.speed_focus_frequency} sessions</span>
                    </div>
                    <div className="flex justify-between p-2 bg-success/10 border border-success/20 rounded">
                      <span className="text-text-primary">Positive Feedback:</span>
                      <span className="font-medium text-success">{patterns.coaching_focus_areas.positive_feedback_frequency} mentions</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Session Quality Trend */}
              {patterns.session_quality_trend && (
                <div>
                  <h4 className="text-sm font-medium text-text-secondary mb-3">Session Quality Trend</h4>
                  <div className="text-xs text-text-secondary mb-2 italic">
                    Quality of training sessions you've attended
                  </div>
                  <div className="p-3 bg-background-primary rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getTrendIcon(patterns.session_quality_trend.direction)}
                        <span className="font-medium text-text-primary capitalize">
                          {patterns.session_quality_trend.direction}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-text-primary">
                          {patterns.session_quality_trend.recent_average.toFixed(1)}/5.0
                        </div>
                        <div className="text-xs text-text-secondary">recent avg</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Primary Coaching Focus */}
              {patterns.primary_coaching_theme && (
                <div>
                  <h4 className="text-sm font-medium text-text-secondary mb-3">Primary Coaching Focus</h4>
                  <div className="text-xs text-text-secondary mb-2 italic">
                    Most common coaching approach in your sessions
                  </div>
                  <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <span className="font-medium text-primary capitalize">
                      {patterns.primary_coaching_theme.replace('_', ' ')} training approach
                    </span>
                  </div>
                </div>
              )}

              {/* Feedback Coverage */}
              {patterns.sessions_with_feedback !== undefined && (
                <div>
                  <h4 className="text-sm font-medium text-text-secondary mb-3">Session Feedback Coverage</h4>
                  <div className="text-xs text-text-secondary mb-2 italic">
                    Proportion of your sessions with detailed coaching notes
                  </div>
                  <div className="p-3 bg-background-primary rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-text-primary">Sessions with Feedback</span>
                      <div className="text-right">
                        <div className="font-semibold text-text-primary">
                          {patterns.sessions_with_feedback}
                        </div>
                        {patterns.feedback_coverage && (
                          <div className="text-xs text-text-secondary">
                            {(patterns.feedback_coverage * 100).toFixed(1)}% coverage
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Attendance Patterns */}
              {patterns.attendance_patterns && (
                <div>
                  <h4 className="text-sm font-medium text-text-secondary mb-3">Attendance Patterns</h4>
                  <div className="text-xs text-text-secondary mb-2 italic">
                    Your training frequency and consistency over time
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between p-2 bg-background-primary rounded">
                      <span className="text-text-primary">Sessions per week:</span>
                      <span className="font-medium text-text-primary">{patterns.attendance_patterns.sessions_per_week}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-background-primary rounded">
                      <span className="text-text-primary">Consistency score:</span>
                      <span className="font-medium text-text-primary">{patterns.attendance_patterns.attendance_consistency_score}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-background-primary rounded">
                      <span className="text-text-primary">Average gap:</span>
                      <span className="font-medium text-text-primary">{patterns.attendance_patterns.average_gap_between_sessions} days</span>
                    </div>
                    {patterns.attendance_patterns.attendance_trend && (
                      <div className={`flex justify-between p-2 rounded ${
                        patterns.attendance_patterns.attendance_trend === 'improving' ? 'bg-success/10 border border-success/20' :
                        patterns.attendance_patterns.attendance_trend === 'declining' ? 'bg-warning/10 border border-warning/20' :
                        'bg-background-primary'
                      }`}>
                        <span className="text-text-primary">Recent trend:</span>
                        <span className={`font-medium capitalize ${
                          patterns.attendance_patterns.attendance_trend === 'improving' ? 'text-success' :
                          patterns.attendance_patterns.attendance_trend === 'declining' ? 'text-warning' :
                          'text-text-primary'
                        }`}>
                          {patterns.attendance_patterns.attendance_trend}
                        </span>
                      </div>
                    )}
                    <div className="text-xs text-text-secondary mt-2">
                      Recent: {patterns.attendance_patterns.recent_sessions_count} sessions (last 4 weeks)
                      {patterns.attendance_patterns.previous_sessions_count > 0 && (
                        <> vs {patterns.attendance_patterns.previous_sessions_count} sessions (previous 4 weeks)</>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Key Insights */}
              {patterns.key_insights && patterns.key_insights.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-text-secondary mb-3">Key Insights</h4>
                  <div className="space-y-2">
                    {patterns.key_insights.map((insight, index) => (
                      <div key={index} className="p-2 bg-accent/10 border border-accent/20 rounded text-sm text-text-primary">
                        {insight}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {patterns.recommendations && patterns.recommendations.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-text-secondary mb-3">Recommendations</h4>
                  <div className="space-y-2">
                    {patterns.recommendations.map((rec, index) => (
                      <div key={index} className="p-2 bg-warning/10 border border-warning/20 rounded text-sm text-text-primary">
                        {rec}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Recommendations */}
      {timeline?.recommendations && timeline.recommendations.length > 0 && (
        <div className="bg-background-card backdrop-blur-sm border border-border rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-5 h-5 text-success" />
            <h3 className="text-lg font-semibold text-text-primary">AI Recommendations</h3>
          </div>
          <div className="space-y-3">
            {timeline.recommendations.map((recommendation, index) => (
              <div key={index} className="flex gap-3 p-4 bg-success/10 border border-success/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />
                <span className="text-text-primary">{recommendation}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}