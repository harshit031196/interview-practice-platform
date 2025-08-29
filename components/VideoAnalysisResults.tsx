'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaceToneLineChart } from '@/components/charts/PaceToneLineChart';
import { SentimentBars } from '@/components/charts/SentimentBars';
import { 
  Mic, 
  Eye, 
  Brain, 
  TrendingUp, 
  Clock, 
  MessageSquare,
  Smile,
  Frown,
  Meh,
  AlertCircle
} from 'lucide-react';

interface VideoAnalysisResultsProps {
  analysisData: {
    speech_analysis?: {
      transcript: string;
      total_words: number;
      words_per_minute: number;
      filler_words: {
        count: number;
        percentage: number;
        details: Array<{
          word: string;
          timestamp: number;
          duration: number;
        }>;
      };
      pacing_analysis: {
        average_wpm: number;
        wpm_standard_deviation: number;
        pacing_consistency: number;
        wpm_timeline: number[];
      };
      clarity_score: number;
    };
    facial_analysis?: {
      emotion_timeline: Array<{
        timestamp: number;
        emotions: {
          joy: number;
          sorrow: number;
          anger: number;
          surprise: number;
        };
        detection_confidence: number;
      }>;
      emotion_statistics: {
        joy: { average: number; max: number; min: number; std: number };
        sorrow: { average: number; max: number; min: number; std: number };
        anger: { average: number; max: number; min: number; std: number };
        surprise: { average: number; max: number; min: number; std: number };
      };
      total_frames_analyzed: number;
      average_detection_confidence: number;
    };
    confidence_analysis?: {
      average_eye_contact_score: number;
      eye_contact_consistency: number;
      head_stability_score: number;
      confidence_score: number;
    };
    overall_score?: {
      overall_score: number;
      component_scores: {
        speech_clarity?: number;
        positivity?: number;
        confidence?: number;
      };
      grade: string;
    };
  };
}

export default function VideoAnalysisResults({ analysisData }: VideoAnalysisResultsProps) {
  const { speech_analysis, facial_analysis, confidence_analysis, overall_score } = analysisData;

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'bg-green-100 text-green-800';
    if (grade.startsWith('B')) return 'bg-blue-100 text-blue-800';
    if (grade.startsWith('C')) return 'bg-yellow-100 text-yellow-800';
    if (grade.startsWith('D')) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Overall Score Card */}
      {overall_score && (
        <Card className="border-2 border-primary/20">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <TrendingUp className="h-6 w-6" />
              Overall Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="flex items-center justify-center gap-4">
              <div className="text-4xl font-bold">
                {Math.round(overall_score.overall_score * 100)}%
              </div>
              <Badge className={getGradeColor(overall_score.grade)} variant="secondary">
                Grade: {overall_score.grade}
              </Badge>
            </div>
            <Progress value={overall_score.overall_score * 100} className="w-full" />
            
            {/* Component Scores */}
            {overall_score.component_scores && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                {overall_score.component_scores.speech_clarity && (
                  <div className="text-center">
                    <div className={`text-2xl font-semibold ${getScoreColor(overall_score.component_scores.speech_clarity)}`}>
                      {Math.round(overall_score.component_scores.speech_clarity * 100)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Speech Clarity</div>
                  </div>
                )}
                {overall_score.component_scores.positivity && (
                  <div className="text-center">
                    <div className={`text-2xl font-semibold ${getScoreColor(overall_score.component_scores.positivity)}`}>
                      {Math.round(overall_score.component_scores.positivity * 100)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Positivity</div>
                  </div>
                )}
                {overall_score.component_scores.confidence && (
                  <div className="text-center">
                    <div className={`text-2xl font-semibold ${getScoreColor(overall_score.component_scores.confidence)}`}>
                      {Math.round(overall_score.component_scores.confidence * 100)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Confidence</div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detailed Analysis Tabs */}
      <Tabs defaultValue="speech" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="speech" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Speech Analysis
          </TabsTrigger>
          <TabsTrigger value="facial" className="flex items-center gap-2">
            <Smile className="h-4 w-4" />
            Facial Analysis
          </TabsTrigger>
          <TabsTrigger value="confidence" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Confidence
          </TabsTrigger>
        </TabsList>

        {/* Speech Analysis Tab */}
        <TabsContent value="speech" className="space-y-4">
          {speech_analysis ? (
            <>
              {/* Speech Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {speech_analysis.words_per_minute && (
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Clock className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                      <div className="text-2xl font-bold">{Math.round(speech_analysis.words_per_minute)}</div>
                      <div className="text-sm text-muted-foreground">Words/Minute</div>
                    </CardContent>
                  </Card>
                )}
                
                {speech_analysis.total_words && (
                  <Card>
                    <CardContent className="p-4 text-center">
                      <MessageSquare className="h-6 w-6 mx-auto mb-2 text-green-600" />
                      <div className="text-2xl font-bold">{speech_analysis.total_words}</div>
                      <div className="text-sm text-muted-foreground">Total Words</div>
                    </CardContent>
                  </Card>
                )}
                
                {speech_analysis.filler_words && (
                  <Card>
                    <CardContent className="p-4 text-center">
                      <AlertCircle className="h-6 w-6 mx-auto mb-2 text-orange-600" />
                      <div className="text-2xl font-bold">{speech_analysis.filler_words.count || 0}</div>
                      <div className="text-sm text-muted-foreground">
                        Filler Words ({Math.round(speech_analysis.filler_words.percentage || 0)}%)
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {speech_analysis.clarity_score && (
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Brain className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                      <div className={`text-2xl font-bold ${getScoreColor(speech_analysis.clarity_score)}`}>
                        {Math.round(speech_analysis.clarity_score * 100)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Clarity Score</div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Pacing Chart */}
              {speech_analysis.pacing_analysis && (
                <Card>
                  <CardHeader>
                    <CardTitle>Speaking Pace Over Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PaceToneLineChart 
                      data={speech_analysis.pacing_analysis.wpm_timeline.map((wpm, index) => ({
                        time: index,
                        pace: wpm
                      }))}
                    />
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Average WPM:</span> {Math.round(speech_analysis.pacing_analysis.average_wpm)}
                      </div>
                      <div>
                        <span className="font-medium">Consistency:</span> {Math.round(speech_analysis.pacing_analysis.pacing_consistency * 100)}%
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Filler Words Details */}
              {speech_analysis.filler_words?.details?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Filler Words Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {speech_analysis.filler_words.details.map((filler, index) => (
                        <div key={index} className="flex justify-between items-center p-2 bg-orange-50 rounded">
                          <span className="font-medium">"{filler.word}"</span>
                          <span className="text-sm text-muted-foreground">
                            at {formatTime(filler.timestamp)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Transcript */}
              <Card>
                <CardHeader>
                  <CardTitle>Full Transcript</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-gray-50 rounded-lg max-h-60 overflow-y-auto">
                    <p className="text-sm leading-relaxed">{speech_analysis.transcript}</p>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Mic className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Speech analysis not available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Facial Analysis Tab */}
        <TabsContent value="facial" className="space-y-4">
          {facial_analysis ? (
            <>
              {/* Emotion Statistics */}
              {facial_analysis.emotion_statistics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {facial_analysis.emotion_statistics.joy && (
                    <Card>
                      <CardContent className="p-4 text-center">
                        <Smile className="h-6 w-6 mx-auto mb-2 text-green-600" />
                        <div className="text-2xl font-bold">
                          {Math.round(facial_analysis.emotion_statistics.joy.average * 100)}%
                        </div>
                        <div className="text-sm text-muted-foreground">Joy</div>
                      </CardContent>
                    </Card>
                  )}
                  
                  {facial_analysis.emotion_statistics.sorrow && (
                    <Card>
                      <CardContent className="p-4 text-center">
                        <Frown className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                        <div className="text-2xl font-bold">
                          {Math.round(facial_analysis.emotion_statistics.sorrow.average * 100)}%
                        </div>
                        <div className="text-sm text-muted-foreground">Sorrow</div>
                      </CardContent>
                    </Card>
                  )}
                  
                  {facial_analysis.emotion_statistics.anger && (
                    <Card>
                      <CardContent className="p-4 text-center">
                        <Meh className="h-6 w-6 mx-auto mb-2 text-red-600" />
                        <div className="text-2xl font-bold">
                          {Math.round(facial_analysis.emotion_statistics.anger.average * 100)}%
                        </div>
                        <div className="text-sm text-muted-foreground">Anger</div>
                      </CardContent>
                    </Card>
                  )}
                  
                  {facial_analysis.emotion_statistics.surprise && (
                    <Card>
                      <CardContent className="p-4 text-center">
                        <AlertCircle className="h-6 w-6 mx-auto mb-2 text-yellow-600" />
                        <div className="text-2xl font-bold">
                          {Math.round(facial_analysis.emotion_statistics.surprise.average * 100)}%
                        </div>
                        <div className="text-sm text-muted-foreground">Surprise</div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Emotion Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Emotional Expression Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <SentimentBars 
                    data={Object.entries(facial_analysis.emotion_statistics).map(([emotion, stats]) => ({
                      emotion: emotion.charAt(0).toUpperCase() + emotion.slice(1),
                      value: Math.round(stats.average * 100)
                    }))}
                  />
                </CardContent>
              </Card>

              {/* Detection Quality */}
              <Card>
                <CardHeader>
                  <CardTitle>Analysis Quality</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Frames Analyzed</div>
                      <div className="text-2xl font-bold">{facial_analysis.total_frames_analyzed}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Detection Confidence</div>
                      <div className="text-2xl font-bold">
                        {Math.round(facial_analysis.average_detection_confidence * 100)}%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Smile className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Facial analysis not available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Confidence Analysis Tab */}
        <TabsContent value="confidence" className="space-y-4">
          {confidence_analysis ? (
            <>
              {/* Confidence Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Eye className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                    <div className={`text-2xl font-bold ${getScoreColor(confidence_analysis.average_eye_contact_score)}`}>
                      {Math.round(confidence_analysis.average_eye_contact_score * 100)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Eye Contact</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-600" />
                    <div className={`text-2xl font-bold ${getScoreColor(confidence_analysis.eye_contact_consistency)}`}>
                      {Math.round(confidence_analysis.eye_contact_consistency * 100)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Consistency</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <Brain className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                    <div className={`text-2xl font-bold ${getScoreColor(confidence_analysis.head_stability_score)}`}>
                      {Math.round(confidence_analysis.head_stability_score * 100)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Head Stability</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="h-6 w-6 mx-auto mb-2 text-indigo-600" />
                    <div className={`text-2xl font-bold ${getScoreColor(confidence_analysis.confidence_score)}`}>
                      {Math.round(confidence_analysis.confidence_score * 100)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Overall Confidence</div>
                  </CardContent>
                </Card>
              </div>

              {/* Confidence Progress Bars */}
              <Card>
                <CardHeader>
                  <CardTitle>Confidence Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Eye Contact</span>
                      <span className="text-sm">{Math.round(confidence_analysis.average_eye_contact_score * 100)}%</span>
                    </div>
                    <Progress value={confidence_analysis.average_eye_contact_score * 100} />
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Consistency</span>
                      <span className="text-sm">{Math.round(confidence_analysis.eye_contact_consistency * 100)}%</span>
                    </div>
                    <Progress value={confidence_analysis.eye_contact_consistency * 100} />
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Head Stability</span>
                      <span className="text-sm">{Math.round(confidence_analysis.head_stability_score * 100)}%</span>
                    </div>
                    <Progress value={confidence_analysis.head_stability_score * 100} />
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Eye className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Confidence analysis not available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
