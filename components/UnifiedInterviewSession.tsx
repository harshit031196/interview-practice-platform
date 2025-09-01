'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Mic, MicOff, Video, VideoOff, Square, Send, MessageCircle, Brain, FileText, Clock, Play } from 'lucide-react';
import { signIn, getSession, useSession } from 'next-auth/react';
import { triggerVideoAnalysisWithRetry, ensureValidSession } from './VideoAnalysisHelper';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  speakerSegments?: Array<{
    speaker: string;
    text: string;
    startTime: number;
    endTime: number;
  }>;
}

interface UnifiedInterviewSessionProps {
  sessionId: string;
  interviewType: string;
  difficulty: string;
  duration: number;
  isConversational: boolean;
  onComplete?: (sessionData: any) => void;
}

// Define a type for individual analysis results for clarity
// This should ideally be moved to a shared types file
type AnalysisSegment = any; // Replace with a more specific type if available

const aggregateAnalysisResults = (results: any[]) => {
  if (!results || results.length === 0) {
    console.log('⚠️ No analysis results to aggregate');
    return {};
  }
  
  console.log(`🔄 Aggregating ${results.length} analysis segments`);
  
  // Validate results array to ensure all items are valid objects
  const validResults = results.filter(result => {
    if (!result || typeof result !== 'object') {
      console.error('⚠️ Invalid result item:', result);
      return false;
    }
    return true;
  });
  
  if (validResults.length === 0) {
    console.error('⚠️ No valid results to aggregate after filtering');
    return {};
  }
  
  // Sort results by segmentIndex to ensure proper order
  validResults.sort((a, b) => {
    const indexA = a.segmentIndex !== undefined ? Number(a.segmentIndex) : 0;
    const indexB = b.segmentIndex !== undefined ? Number(b.segmentIndex) : 0;
    return indexA - indexB;
  });
  
  // Log segment information for debugging
  validResults.forEach((result, i) => {
    console.log(`Segment ${i}: index=${result.segmentIndex || 0}, id=${result.id ? result.id.substring(0, 8) : 'unknown'}`);
  });

  const aggregated = {
    speech_analysis: {
      transcript: '',
      total_words: 0,
      words_per_minute: 0,
      clarity_score: 0,
      filler_words: { count: 0, percentage: 0, details: [] as any[] },
      pacing_analysis: { wpm_timeline: [] as any[] },
      utterances: [] as any[],
    },
    facial_analysis: {
      emotion_timeline: [] as any[],
      emotion_statistics: {
        joy: { average: 0, max: 0, min: 1, std: 0 },
        sorrow: { average: 0, max: 0, min: 1, std: 0 },
        anger: { average: 0, max: 0, min: 1, std: 0 },
        surprise: { average: 0, max: 0, min: 1, std: 0 },
      },
      total_frames_analyzed: 0,
      average_detection_confidence: 0,
    },
    confidence_analysis: {
      average_eye_contact_score: 0,
      eye_contact_consistency: 0,
      head_stability_score: 0,
      confidence_score: 0,
    },
    overall_score: { 
        overall_score: 0,
        grade: '',
        component_scores: {}
    },
    annotationResults: [] as any[],
    durationSec: 0,
  };

  const numResults = results.length;

  validResults.forEach(result => {
    try {
      // Extract results from either direct results field or nested in analysisData
      const analysis = result.results || result.analysisData || {};
      aggregated.durationSec += analysis.durationSec || 0;

      // Aggregate speech analysis
      if (analysis.speech_analysis) {
        aggregated.speech_analysis.transcript += analysis.speech_analysis.transcript + ' ';
        aggregated.speech_analysis.total_words += analysis.speech_analysis.total_words || 0;
        aggregated.speech_analysis.words_per_minute += (analysis.speech_analysis.words_per_minute || 0) / numResults;
        aggregated.speech_analysis.clarity_score += (analysis.speech_analysis.clarity_score || 0) / numResults;
        if (analysis.speech_analysis.filler_words) {
          aggregated.speech_analysis.filler_words.count += analysis.speech_analysis.filler_words.count || 0;
          aggregated.speech_analysis.filler_words.details.push(...(analysis.speech_analysis.filler_words.details || []));
        }
        if (analysis.speech_analysis.pacing_analysis) {
          aggregated.speech_analysis.pacing_analysis.wpm_timeline.push(...(analysis.speech_analysis.pacing_analysis.wpm_timeline || []));
        }
        if(analysis.speech_analysis.utterances) {
          aggregated.speech_analysis.utterances.push(...(analysis.speech_analysis.utterances || []));
        }
      }

      // Aggregate facial analysis
      if (analysis.facial_analysis) {
        aggregated.facial_analysis.total_frames_analyzed += analysis.facial_analysis.total_frames_analyzed || 0;
        aggregated.facial_analysis.average_detection_confidence += (analysis.facial_analysis.average_detection_confidence || 0) / numResults;
        if (analysis.facial_analysis.emotion_statistics) {
          for (const emotion in aggregated.facial_analysis.emotion_statistics) {
            const key = emotion as keyof typeof aggregated.facial_analysis.emotion_statistics;
            if (analysis.facial_analysis.emotion_statistics[key]) {
              aggregated.facial_analysis.emotion_statistics[key].average += analysis.facial_analysis.emotion_statistics[key].average / numResults;
              aggregated.facial_analysis.emotion_statistics[key].max = Math.max(aggregated.facial_analysis.emotion_statistics[key].max, analysis.facial_analysis.emotion_statistics[key].max);
              aggregated.facial_analysis.emotion_statistics[key].min = Math.min(aggregated.facial_analysis.emotion_statistics[key].min, analysis.facial_analysis.emotion_statistics[key].min);
            }
          }
        }
      }

      // Aggregate confidence analysis
      if (analysis.confidence_analysis) {
        aggregated.confidence_analysis.average_eye_contact_score += (analysis.confidence_analysis.average_eye_contact_score || 0) / numResults;
        aggregated.confidence_analysis.eye_contact_consistency += (analysis.confidence_analysis.eye_contact_consistency || 0) / numResults;
        aggregated.confidence_analysis.head_stability_score += (analysis.confidence_analysis.head_stability_score || 0) / numResults;
        aggregated.confidence_analysis.confidence_score += (analysis.confidence_analysis.confidence_score || 0) / numResults;
      }

      // Combine raw annotation results for debugging and detailed views
      if (result.annotationResults) {
          aggregated.annotationResults.push(...result.annotationResults);
      }
    } catch (error) {
      console.error('Error processing segment data:', error, 'Segment:', result);
    }
  });

  // Final calculations
  if (aggregated.speech_analysis.total_words > 0) {
      aggregated.speech_analysis.filler_words.percentage = (aggregated.speech_analysis.filler_words.count / aggregated.speech_analysis.total_words) * 100;
  }
  
  // Ensure transcript is a string before trimming
  if (typeof aggregated.speech_analysis.transcript === 'string') {
    aggregated.speech_analysis.transcript = aggregated.speech_analysis.transcript.trim();
  } else {
    aggregated.speech_analysis.transcript = '';
  }
  
  console.log('✅ Analysis aggregation completed successfully');
  return { videoAnalysis: aggregated };
};

function UnifiedInterviewSession({
  sessionId,
  interviewType,
  difficulty,
  duration,
  isConversational,
  onComplete
}: UnifiedInterviewSessionProps) {
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isContinuousRecording, setIsContinuousRecording] = useState(false);
  
  // Debug logging for isContinuousRecording state changes
  useEffect(() => {
    console.log(`🎥 [State] isContinuousRecording changed: ${isContinuousRecording}`);
  }, [isContinuousRecording]);
  const [videoSegmentUris, setVideoSegmentUris] = useState<string[]>([]);
  const [continuousVideoBlob, setContinuousVideoBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  
  // Conversational AI states
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [feedbackData, setFeedbackData] = useState<any>({});
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [interviewStarted, setInterviewStarted] = useState(false);
  
  // Debug logging for interviewStarted state changes
  useEffect(() => {
    console.log(`🎬 [State] interviewStarted changed: ${interviewStarted}`);
  }, [interviewStarted]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isInterviewFlowCompleted, setInterviewFlowCompleted] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  // Timer states
  const [timeRemaining, setTimeRemaining] = useState(duration * 60); // Convert to seconds
  const [timerActive, setTimerActive] = useState(false);
  
  // Media refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const aiVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const visionAnalysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPollTimestampRef = useRef<number>(Date.now());

  // Vision API states
  const [visionAnalysisData, setVisionAnalysisData] = useState<any[]>([]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setTimerActive(false);
            handleEndInterview();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeRemaining]);

  // Function to play AI audio
  const playAiAudio = useCallback(async (text: string) => {
    if (!text || !audioPlayerRef.current) return;

    try {
      setIsAiSpeaking(true);
      const response = await fetch('/api/ai/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        audioPlayerRef.current.src = url;
        audioPlayerRef.current.play();
        audioPlayerRef.current.onended = () => {
          setIsAiSpeaking(false);
          URL.revokeObjectURL(url);
        };
      } else {
        console.error('Failed to fetch TTS audio.');
        setIsAiSpeaking(false);
      }
    } catch (error) {
      console.error('Error in playAiAudio:', error);
      setIsAiSpeaking(false);
    }
  }, []);

  // Effect to play audio when a new question is set
  useEffect(() => {
    if (currentQuestion && isConversational) {
      playAiAudio(currentQuestion);
    }
  }, [currentQuestion, isConversational, playAiAudio]);

  // Effect to sync AI video with speech
  useEffect(() => {
    if (aiVideoRef.current) {
      if (isAiSpeaking) {
        aiVideoRef.current.play().catch(e => console.error('AI video play error:', e));
      } else {
        aiVideoRef.current.pause();
      }
    }
  }, [isAiSpeaking]);
  
  // Effect to ensure video display when stream is attached
  useEffect(() => {
    if (interviewStarted && videoRef.current && streamRef.current) {
      console.log('🔄 [Video] Ensuring video stream is properly attached');
      
      // Re-attach stream if needed
      if (!videoRef.current.srcObject) {
        console.log('🔄 [Video] Re-attaching stream to video element');
        videoRef.current.srcObject = streamRef.current;
      }
      
      // Ensure video is playing
      if (videoRef.current.paused) {
        videoRef.current.play().catch(e => {
          console.error('❌ [Video] Error playing video in effect:', e);
        });
      }
    }
  }, [interviewStarted]);


  const pollForAnalysisResults = useCallback(() => {
    if (isPolling) return;
    setIsPolling(true);
    lastPollTimestampRef.current = Date.now();
    console.log('🔄 [Polling] Starting to poll for analysis results for all segments...');

    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`/api/video-analysis?sessionId=${sessionId}`);
        if (response.ok) {
          const analyses = await response.json();
          // For continuous recording, we expect only 1 segment (the full video)
          // For segment-based recording, we use the videoSegmentUris length
          const expectedSegments = isContinuousRecording ? 1 : videoSegmentUris.length;
          const receivedSegments = analyses.length;

          console.log(`🔄 [Polling] Status: ${receivedSegments} of ${expectedSegments} segments analyzed.`);
          console.log(`🔄 [Polling] Recording mode: ${isContinuousRecording ? 'Continuous' : 'Segmented'}`);
          console.log(`🔄 [Polling] Video segment URIs: ${JSON.stringify(videoSegmentUris)}`);
          console.log(`🔄 [Polling] Continuous video blob exists: ${continuousVideoBlob ? 'Yes' : 'No'}`);
          console.log(`🔄 [Polling] Analysis results count: ${analyses.length}`);

          // Check if all expected segments have been analyzed
          // We need to verify both the count and that each segment has valid results
          const allSegmentsAnalyzed = receivedSegments >= expectedSegments && 
            analyses.every((analysis: any) => {
              if (!analysis) {
                console.log('Found null or undefined analysis object');
                return false;
              }
              // Extract results from either direct results field or nested in analysisData
              const resultsData = analysis.results || (analysis.analysisData ? analysis.analysisData : null);
              const hasResults = resultsData && typeof resultsData === 'object' && Object.keys(resultsData).length > 0;
              if (!hasResults) {
                console.log(`Segment ${analysis.segmentIndex !== undefined ? analysis.segmentIndex : 'unknown'} has empty results`);
              }
              return hasResults;
            });
            
          // Force completion if we have at least one analyzed segment and it's been more than 30 seconds
          const forceCompletion = receivedSegments > 0 && 
            (Date.now() - lastPollTimestampRef.current) > 30000;
            
          if (allSegmentsAnalyzed || forceCompletion) {
            if (forceCompletion) {
              console.log('⚠️ [Polling] Force completing interview flow after 30 seconds with partial results');
            }
            console.log(`All ${expectedSegments} segments analyzed. Aggregating results.`);
            try {
              const aggregatedResults = aggregateAnalysisResults(analyses);
              // Store the aggregated results for later use
              setAnalysisResults(aggregatedResults);
              // Also update the feedbackData state to include video analysis results
              setFeedbackData((prevData: any) => ({ ...prevData, videoAnalysis: aggregatedResults.videoAnalysis }));
              if (isConversational) {
              setAnalysisProgress('Video analysis complete. Generating conversational feedback...');
              try {
                console.log('🔄 [Feedback] Triggering conversational feedback API...');
                const feedbackResponse = await fetch('/api/ai/feedback', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId, conversationHistory: messages }),
                });

                if (feedbackResponse.ok) {
                  console.log('✅ [Feedback] Conversational feedback generated successfully.');
                  setAnalysisProgress('All analyses complete! Preparing results...');
                } else {
                  console.error('❌ [Feedback] Conversational feedback API failed:', feedbackResponse.status);
                  setAnalysisProgress('Could not generate conversational feedback. Video results are available.');
                }
              } catch (error) {
                console.error('❌ [Feedback] Error calling feedback API:', error);
                setAnalysisProgress('An error occurred during conversational feedback generation.');
              } finally {
                setInterviewFlowCompleted(true);
              }
            } else {
              setAnalysisProgress('Analysis complete! Preparing results...');
              setInterviewFlowCompleted(true);
            }
            } catch (error) {
              console.error('Error during result aggregation:', error);
              setAnalysisProgress('Error aggregating analysis results. Please try again.');
            }
          } else {
            setAnalysisProgress(`Analysis in progress: ${receivedSegments} of ${expectedSegments} segments analyzed...`);
          }
        } else if (response.status === 404) {
          console.log('🔄 [Polling] Analysis not ready yet... No results found.');
          const expectedSegments = isContinuousRecording ? 1 : videoSegmentUris.length;
          
          // Check if we've uploaded any segments yet
          if (expectedSegments > 0) {
            // Check if any segments have been successfully uploaded
            // For continuous recording, we check if we have a continuousVideoBlob
            const uploadedSegments = isContinuousRecording 
              ? (continuousVideoBlob ? 1 : 0) 
              : videoSegmentUris.filter(uri => uri).length;
            
            if (uploadedSegments === 0) {
              setAnalysisProgress('Analysis in progress, waiting for video upload...');
            } else if (uploadedSegments < expectedSegments) {
              setAnalysisProgress(`Analysis in progress, ${uploadedSegments} of ${expectedSegments} segments uploaded...`);
            } else {
              setAnalysisProgress(`Analysis in progress, processing ${expectedSegments} segments...`);
            }
          } else {
            setAnalysisProgress('Analysis in progress, waiting for first segment...');
          }
        } else {
          console.error(`❌ [Polling] Error checking analysis status: ${response.status}`);
          setAnalysisProgress('An error occurred while fetching analysis status.');
          // Do not stop polling on transient server errors, let the timeout handle it.
        }
      } catch (error) {
        console.error('❌ [Polling] Network error checking analysis status:', error);
        setAnalysisProgress('Network error. Retrying...');
      }
    }, 10000); // Increased polling interval to 10s to reduce load

    // Safety timeout after 10 minutes for multi-segment analysis
    const timeoutId = setTimeout(() => {
      clearInterval(intervalId);
      if (isPolling) {
        console.log('⌛️ [Polling] Polling timed out.');
        setIsPolling(false);
        setAnalysisProgress('Analysis is taking longer than expected. Please check the feedback page later.');
        setInterviewFlowCompleted(true); // Complete flow to avoid getting stuck
      }
    }, 600000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [isPolling, sessionId, messages, isConversational, videoSegmentUris.length, isContinuousRecording, continuousVideoBlob]);

  const analyzeFrame = useCallback(async () => {
    if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
      return;
    }

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageDataUrl = canvas.toDataURL('image/jpeg');

      try {
        console.log('📸 [Vision] Capturing and analyzing frame...');
        const response = await fetch('/api/vision/analyze-frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            image: imageDataUrl,
            sessionId: sessionId 
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setVisionAnalysisData(prevData => [...prevData, { timestamp: Date.now(), ...data }]);
            console.log('✅ [Vision] Frame analysis successful');
          }
        } else {
          console.error('❌ [Vision] Frame analysis API failed:', response.status);
        }
      } catch (error) {
        console.error('❌ [Vision] Error sending frame for analysis:', error);
      }
    }
  }, [sessionId]);

  const startFrameAnalysis = useCallback(() => {
    if (visionAnalysisIntervalRef.current) return; // Already running
    visionAnalysisIntervalRef.current = setInterval(analyzeFrame, 5000);
    console.log('▶️ [Vision] Started frame analysis.');
  }, [analyzeFrame]);

  const stopFrameAnalysis = useCallback(() => {
    if (visionAnalysisIntervalRef.current) {
      clearInterval(visionAnalysisIntervalRef.current);
      visionAnalysisIntervalRef.current = null;
      console.log('⏹️ [Vision] Stopped frame analysis.');
    }
  }, []);

  // Start continuous video recording
  const startContinuousRecording = useCallback(() => {
    if (!streamRef.current) {
      console.error('❌ [Video] Cannot start continuous recording: No media stream available');
      return;
    }
    
    if (isContinuousRecording) {
      console.log('⚠️ [Video] Continuous recording already in progress');
      return;
    }
    
    console.log('DEBUG: Starting continuous recording with stream:', streamRef.current ? 'Available' : 'Not available');

    try {
      console.log('▶️ [Video] Starting continuous recording...');
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp9,opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Set up data collection at regular intervals (e.g., every 1 second)
      // This ensures we collect data throughout the recording without waiting for stop
      mediaRecorder.start(1000);
      
      setIsContinuousRecording(true);
      console.log('✅ [Video] Continuous recording started');
    } catch (error) {
      console.error('❌ [Video] Failed to start continuous recording:', error);
    }
  }, []); // Remove isContinuousRecording from dependency array to avoid re-creation issues

  // Effect to handle interview completion and redirection
  useEffect(() => {
    if (isInterviewFlowCompleted) {
      console.log('Interview flow complete, calling onComplete...');
      onComplete?.({
        sessionId,
        status: 'processing',
        hasVideo: videoSegmentUris.length > 0,
        hasConversation: isConversational && messages.length > 0,
        messages: isConversational ? messages : []
      });
    }
  }, [isInterviewFlowCompleted, onComplete, sessionId, videoSegmentUris, isConversational, messages]);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Start the interview with continuous recording
  const startInterview = useCallback(async () => {
    setIsProcessing(true);
    // Set interview as started immediately to prevent button reappearing
    setInterviewStarted(true);
    setTimerActive(true);
    
    try {
      // Get camera and microphone access
      console.log('▶️ [Video] Requesting media devices...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      console.log('✅ [Video] Media stream acquired.');
      
      streamRef.current = stream;
      if (videoRef.current) {
        console.log('▶️ [Video] Attaching stream to video element.');
        videoRef.current.srcObject = stream;
        
        // Add debugging to check video element state
        console.log('Video element state:', {
          width: videoRef.current.offsetWidth,
          height: videoRef.current.offsetHeight,
          videoWidth: videoRef.current.videoWidth,
          videoHeight: videoRef.current.videoHeight,
          paused: videoRef.current.paused,
          muted: videoRef.current.muted
        });
        
        // Force a timeout before playing to ensure DOM is ready
        setTimeout(() => {
          if (videoRef.current) {
            const playPromise = videoRef.current.play();
            if (playPromise) {
              playPromise.then(() => {
                console.log('Video playing successfully, starting continuous recording');
                // Start continuous recording after video is playing
                startContinuousRecording();
              }).catch(() => {
                console.log('Second play attempt failed, video may need user interaction');
              });
            }
          }
        }, 500);
      } else {
        console.error('❌ [Video] videoRef.current is null. Cannot attach stream.');
      }

      if (isConversational) {
        // Get initial AI question
        const response = await fetch('/api/ai/interviewer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            jobRole: 'Software Engineer',
            company: 'FAANG',
            interviewType,
            conversationHistory: []
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('AI interviewer response:', data);
          const newQuestion = data.question;
          setCurrentQuestion(newQuestion);
          setMessages([{ 
            role: 'assistant', 
            content: newQuestion, 
            timestamp: new Date() 
          }]);
          await playAiAudio(newQuestion);
        } else {
          console.error('AI interviewer API error:', response.status, await response.text());
          // Fallback question if API fails
          const fallbackQuestion = `Hello! I'm your AI interviewer today. Let's start with a ${interviewType} question. Tell me about a challenging ${interviewType === 'behavioral' ? 'situation you faced at work' : interviewType === 'technical' ? 'technical problem you solved' : interviewType === 'system-design' ? 'system you designed' : 'project you worked on'} and how you handled it.`;
          setCurrentQuestion(fallbackQuestion);
          setMessages([{ 
            role: 'assistant', 
            content: fallbackQuestion, 
            timestamp: new Date() 
          }]);
          await playAiAudio(fallbackQuestion);
        }
      }
    } catch (error) {
      console.error('Failed to start interview:', error);
      alert('Failed to access camera/microphone. Please check permissions.');
    } finally {
      setIsProcessing(false);
    }
  }, [sessionId, interviewType, isConversational, startFrameAnalysis, playAiAudio, startContinuousRecording]);

  const uploadVideoSegment = useCallback(async (segmentBlob: Blob, segmentIndex: number) => {
    console.log(`[Segment Upload] Uploading segment ${segmentIndex}...`);
    const formData = new FormData();
    formData.append('file', segmentBlob, `interview_${sessionId}_segment_${segmentIndex}_${Date.now()}.webm`);
    formData.append('sessionId', sessionId);

    try {
      const uploadResponse = await fetch('/api/upload/direct', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: { 'X-Auth-Method': 'hybrid-session' }
      });

      if (uploadResponse.ok) {
        const { videoUri } = await uploadResponse.json();
        console.log(`[Segment Upload] Segment ${segmentIndex} uploaded successfully: ${videoUri}`);
        setVideoSegmentUris(prev => [...prev, videoUri]);
        
        // Asynchronously trigger analysis for the segment
        console.log(`[Segment Analysis] Triggering analysis for segment: ${videoUri}`);
        triggerVideoAnalysisWithRetry(
          videoUri,
          sessionId, // Use the base sessionId
          3,
          (message: string) => console.log(`[Segment Analysis] Progress for segment ${segmentIndex}: ${message}`),
          segmentIndex // Pass segmentIndex separately
        ).catch(err => console.error(`[Segment Analysis] Failed for segment ${segmentIndex}:`, err));

        return videoUri;
      } else {
        console.error(`[Segment Upload] Segment ${segmentIndex} upload failed:`, uploadResponse.status);
        const errorText = await uploadResponse.text();
        console.error('[Segment Upload] Upload error details:', errorText);
        return null;
      }
    } catch (error) {
      console.error(`[Segment Upload] Error uploading segment ${segmentIndex}:`, error);
      return null;
    }
  }, [sessionId]);


  // Process conversational response - only process audio, don't upload video segments
  const processConversationalResponse = useCallback(async (videoBlob: Blob, segmentIndex: number) => {
    setIsProcessing(true);
    try {
      console.log('Processing conversational response, blob size:', videoBlob.size);
      console.log(`Processing segment with index: ${segmentIndex}`);

      // We don't upload video segments anymore - we'll upload the full video at the end
      // Instead, just process the audio for speech-to-text
      
      // Create FormData for direct upload to speech API
      const formData = new FormData();
      formData.append('audio', videoBlob, `response_${Date.now()}.webm`);
      formData.append('sessionId', sessionId);
      formData.append('enableDiarization', 'true');
      
      // Send to speech-to-text API
      const speechResponse = await fetch('/api/ai/speech-stream', {
        method: 'POST',
        body: formData // Send as FormData instead of JSON
      });

      if (speechResponse.ok) {
        const speechData = await speechResponse.json();
        console.log('Speech response:', speechData);
        
        let userTranscript = '';
        if (speechData.transcripts && speechData.transcripts.length > 0) {
          userTranscript = speechData.transcripts
            .map((t: any) => t.text || t.transcript || '')
            .join(' ')
            .trim();
        } else if (speechData.transcript) {
          userTranscript = speechData.transcript.trim();
        }

        console.log('User transcript:', userTranscript);

        if (userTranscript) {
          // Add user message
          const userMessage: Message = {
            role: 'user',
            content: userTranscript,
            timestamp: new Date(),
            speakerSegments: speechData.speakerSegments
          };

          setMessages(prev => {
            const newMessages = [...prev, userMessage];
            console.log('Updated messages:', newMessages);
            return newMessages;
          });

          // Get AI response
          const aiResponse = await fetch('/api/ai/interviewer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userResponse: userTranscript,
              conversationHistory: [...messages, userMessage].map(m => ({
                role: m.role,
                content: m.content
              })),
              sessionId,
              jobRole: 'Software Engineer',
              company: 'FAANG',
              interviewType
            })
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            console.log('AI response:', aiData);
            const newQuestion = aiData.question;
            setCurrentQuestion(newQuestion);
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: newQuestion,
              timestamp: new Date()
            }]);
            await playAiAudio(newQuestion);
          } else {
            console.error('AI response failed:', aiResponse.status, await aiResponse.text());
          }
        } else {
          console.warn('No transcript received from speech API');
          // Show error message instead of prompt
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'I had trouble processing your audio response. Please try speaking again or click "End Interview" if you\'re finished.',
            timestamp: new Date()
          }]);
        }
      } else {
        console.error('Speech API failed:', speechResponse.status, await speechResponse.text());
        // Show error in conversation instead of alert
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'I had trouble processing your audio. Please try recording your response again, or click "End Interview" if you\'re ready to finish.',
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Failed to process conversational response:', error);
      // Show error in conversation instead of alert
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I encountered an error processing your response. Please try again or click "End Interview" to finish.',
        timestamp: new Date()
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [messages, sessionId, interviewType, playAiAudio]);

  const startAnswering = useCallback(async () => {
    if (!streamRef.current || !isContinuousRecording) return;

    try {
      // Mark the start time of this answer segment
      const answerStartTime = Date.now();
      console.log(`[Answer] Starting answer at timestamp: ${answerStartTime}`);
      
      // We're not starting a new recording, just marking that the user is answering
      setIsAnswering(true);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start answer segment:', error);
    }
  }, [isContinuousRecording]);

  const stopAnswering = useCallback(async () => {
    if (!isAnswering || !isContinuousRecording) return;
    
    try {
      // We don't stop the continuous recording, just mark that the answer is complete
      setIsAnswering(false);
      setIsRecording(false);
      
      // Create a snapshot of the current chunks for this answer segment
      // This allows us to process the audio without interrupting the continuous recording
      const currentChunks = [...chunksRef.current];
      const answerBlob = new Blob(currentChunks, { type: 'video/webm' });
      
      // Process this answer segment
      const segmentIndex = videoSegmentUris.length;
      console.log(`[Answer] Processing answer segment ${segmentIndex}, size: ${answerBlob.size} bytes`);
      
      // Process the audio from this segment without uploading the video yet
      await processConversationalResponse(answerBlob, segmentIndex);
    } catch (error) {
      console.error('Failed to stop answer segment:', error);
    }
  }, [isAnswering, isContinuousRecording, processConversationalResponse, videoSegmentUris.length]);

  // Function to stop continuous recording and get the full video blob
  const stopContinuousRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !isContinuousRecording) return null;
    
    return new Promise<Blob>((resolve) => {
      console.log('Stopping continuous recording...');
      
      // Save the current ondataavailable handler
      const originalDataHandler = mediaRecorderRef.current!.ondataavailable;
      
      // Create a new handler for the stop event
      mediaRecorderRef.current!.onstop = () => {
        console.log('Continuous recording stopped, creating final video blob');
        const fullVideoBlob = new Blob(chunksRef.current, { type: 'video/webm' });
        setContinuousVideoBlob(fullVideoBlob);
        setIsContinuousRecording(false);
        console.log(`Full video size: ${fullVideoBlob.size} bytes`);
        resolve(fullVideoBlob);
      };
      
      // Stop the recording
      mediaRecorderRef.current!.stop();
    });
  }, [isContinuousRecording]);

  // Upload the full continuous video
  const uploadFullVideo = useCallback(async (videoBlob: Blob) => {
    console.log(`[Full Video Upload] Uploading full video, size: ${videoBlob.size} bytes...`);
    const formData = new FormData();
    formData.append('file', videoBlob, `interview_${sessionId}_full_${Date.now()}.webm`);
    formData.append('sessionId', sessionId);

    try {
      const uploadResponse = await fetch('/api/upload/direct', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: { 'X-Auth-Method': 'hybrid-session' }
      });

      if (uploadResponse.ok) {
        const { videoUri } = await uploadResponse.json();
        console.log(`[Full Video Upload] Full video uploaded successfully: ${videoUri}`);
        setVideoSegmentUris([videoUri]); // Replace any previous segments with just this one full video
        
        // Trigger analysis for the full video
        console.log(`[Full Video Analysis] Triggering analysis for full video: ${videoUri}`);
        await triggerVideoAnalysisWithRetry(
          videoUri,
          sessionId,
          3,
          (message: string) => console.log(`[Full Video Analysis] Progress: ${message}`),
          0 // Use segment index 0 for the full video
        );

        return videoUri;
      } else {
        console.error(`[Full Video Upload] Upload failed:`, uploadResponse.status);
        const errorText = await uploadResponse.text();
        console.error('[Full Video Upload] Upload error details:', errorText);
        return null;
      }
    } catch (error) {
      console.error(`[Full Video Upload] Error uploading full video:`, error);
      return null;
    }
  }, [sessionId]);

  // Enhanced end interview with JWT session validation
  const handleEndInterview = useCallback(async () => {
    console.log('handleEndInterview called');
    stopFrameAnalysis();
    setTimerActive(false);
    
    setIsAnalyzing(true);
    setAnalysisProgress('Starting video processing...');
    
    try {
      // Check database session validity before starting critical operations
      const sessionValid = await ensureValidSession();
      if (!sessionValid) {
        console.log('Session validation failed, but continuing with upload...');
        setAnalysisProgress('Session may have expired - video will be saved, please refresh the page after upload completes');
      } else {
        console.log('Session validated successfully, proceeding with upload and analysis');
      }
      
      // Stop the continuous recording and get the full video blob
      if (isContinuousRecording) {
        setAnalysisProgress('Finalizing video recording...');
        const fullVideoBlob = await stopContinuousRecording();
        
        if (fullVideoBlob) {
          setAnalysisProgress('Uploading full interview video...');
          const videoUri = await uploadFullVideo(fullVideoBlob);
          
          if (videoUri) {
            console.log('Full video uploaded successfully, updating session status');
            setAnalysisProgress('Video uploaded. Analysis is running in the background.');
            
            // Update session status to completed
            await fetch(`/api/ai/session/${sessionId}`, {
              method: 'PATCH',
              headers: { 
                'Content-Type': 'application/json',
                'X-Auth-Method': 'hybrid-session'
              },
              credentials: 'include',
              body: JSON.stringify({ status: 'COMPLETED' })
            });

            // Save vision analysis frames
            if (visionAnalysisData.length > 0) {
              console.log(`Saving ${visionAnalysisData.length} vision analysis frames...`);
              await fetch('/api/vision/save-frames', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, frames: visionAnalysisData }),
              }).catch(error => console.error('Failed to save vision analysis frames:', error));
            }

            // Start polling for the analysis results
            pollForAnalysisResults();
          } else {
            console.error('Failed to upload full video');
            setAnalysisProgress('Failed to upload video. Please try again.');
            setInterviewFlowCompleted(true);
          }
        } else {
          console.error('Failed to get full video blob');
          setAnalysisProgress('Failed to finalize video recording. Please try again.');
          setInterviewFlowCompleted(true);
        }
      } else if (isConversational) {
        // If conversational but no videos, still end the session and generate text-based feedback
        setAnalysisProgress('Generating conversational feedback...');
        const feedbackResponse = await fetch('/api/ai/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, conversationHistory: messages }),
        });
        if (feedbackResponse.ok) {
          setAnalysisProgress('Feedback generated. Preparing results...');
        } else {
          setAnalysisProgress('Could not generate feedback.');
        }
        setInterviewFlowCompleted(true);
      } else {
        // No video recorded, just end the flow
        setInterviewFlowCompleted(true);
      }

      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      console.log('handleEndInterview finished, analysis is processing in the background.');
      
    } catch (error) {
      console.error('Error in handleEndInterview:', error);
      // Still call onComplete to ensure flow continues
      onComplete?.({
        sessionId,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        hasVideo: videoSegmentUris.length > 0,
        hasConversation: isConversational && messages.length > 0,
        messages: isConversational ? messages : []
      });
    }
  }, [sessionId, messages, isConversational, onComplete, pollForAnalysisResults, stopFrameAnalysis, visionAnalysisData, ensureValidSession, videoSegmentUris, isContinuousRecording, stopContinuousRecording, uploadFullVideo]);
  return (
    <div className="flex flex-col gap-4 w-full max-w-5xl mx-auto">
      <audio ref={audioPlayerRef} />
      {/* Interview Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{interviewType} Interview</h2>
          <div className="flex gap-2 mt-1">
            <Badge variant="outline">{difficulty}</Badge>
            <Badge variant="outline">{isConversational ? 'Conversational' : 'Traditional'}</Badge>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-mono">{formatTime(timeRemaining)}</div>
          <div className="text-sm text-muted-foreground">Time Remaining</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Video Feed */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex justify-between items-center">
              <span>Video Feed</span>
              {interviewStarted && (
                <Badge variant={isRecording ? "destructive" : "outline"} className="ml-2">
                  {isRecording ? 'Recording' : 'Ready'}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-video bg-black rounded-md overflow-hidden">
              {!interviewStarted ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button 
                    onClick={startInterview} 
                    disabled={isProcessing}
                    className="flex items-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Start Interview
                  </Button>
                </div>
              ) : (
                <>
                  <video 
                    ref={videoRef} 
                    className="w-full h-full object-cover z-10" 
                    autoPlay
                    playsInline
                    muted
                    style={{ display: 'block' }}
                  />
                  <video
                    ref={aiVideoRef}
                    src="/videos/ai-interviewer.mp4" // Using a stock video
                    loop
                    playsInline
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isAiSpeaking ? 'opacity-70' : 'opacity-0'} z-0`}
                    style={{ pointerEvents: 'none' }}
                  />
                  <audio ref={audioRef} />
                  <div className="absolute bottom-2 right-2 flex gap-2">
                    {isConversational ? (
                      isRecording ? (
                        <Button size="sm" variant="destructive" onClick={stopAnswering} disabled={isProcessing}>
                          <Square className="h-4 w-4 mr-1" />
                          Stop Answering
                        </Button>
                      ) : (
                        <>
                          {/* Debug log for button conditions */}
                          {console.log('Start Answering button conditions:', { 
                            isProcessing, 
                            isAiSpeaking, 
                            interviewStarted, 
                            isContinuousRecording,
                            shouldBeDisabled: isProcessing || isAiSpeaking || !interviewStarted || !isContinuousRecording
                          })}
                          <Button 
                            size="sm" 
                            variant="default" 
                            onClick={startAnswering} 
                            disabled={isProcessing || isAiSpeaking || !interviewStarted || !isContinuousRecording}
                          >
                            <Mic className="h-4 w-4 mr-1" />
                            Start Answering
                          </Button>
                        </>
                      )
                    ) : null}
                  </div>
                </>
              )}
            </div>
            
            {/* Controls */}
            {interviewStarted && !isAnalyzing && (
              <div className="mt-4 flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.srcObject = null;
                    }
                    if (streamRef.current) {
                      streamRef.current.getTracks().forEach(track => track.stop());
                    }
                    setInterviewStarted(false);
                    setTimerActive(false);
                  }}
                  disabled={isProcessing || isRecording}
                >
                  Restart
                </Button>
                <Button 
                  variant="default" 
                  onClick={handleEndInterview}
                  disabled={isProcessing || isRecording}
                >
                  End Interview
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversation / Instructions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>
              {isConversational ? 'Conversation' : 'Instructions'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isConversational ? (
              <div className="flex flex-col gap-4 h-[350px] overflow-y-auto">
                {messages.map((message, index) => (
                  <div 
                    key={index} 
                    className={`p-3 rounded-lg ${
                      message.role === 'assistant' 
                        ? 'bg-primary/10 text-black' 
                        : 'bg-muted text-black'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {message.role === 'assistant' ? (
                        <Brain className="h-3 w-3" />
                      ) : (
                        <MessageCircle className="h-3 w-3" />
                      )}
                      <span className="text-xs font-medium">
                        {message.role === 'assistant' ? 'Interviewer' : 'You'}
                      </span>
                    </div>
                    <div className="text-sm">{message.content}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p>This is a traditional interview session. Please:</p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Click "Start Interview" to begin</li>
                  <li>Click "Record" when you're ready to answer</li>
                  <li>Click "Stop" when you've finished your response</li>
                  <li>Click "End Interview" when you're done</li>
                </ol>
                <p className="text-sm text-muted-foreground mt-4">
                  Your video will be analyzed and feedback will be provided after the interview.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Analysis Status */}
      {isAnalyzing && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Analysis Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={isInterviewFlowCompleted ? 100 : 50} className="mb-2" />
            <p className="text-sm text-muted-foreground">{analysisProgress}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default UnifiedInterviewSession;
