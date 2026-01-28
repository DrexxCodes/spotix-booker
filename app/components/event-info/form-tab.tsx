"use client"

import { useState, useEffect } from "react"
import {
  Plus,
  Trash2,
  GripVertical,
  FileText,
  Hash,
  ListChecks,
  Circle,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Calendar,
  Clock,
} from "lucide-react"
import { FormSettings } from "./helper/form-settings"

interface Question {
  id?: string
  questionText: string
  questionType: "short" | "long" | "number" | "radio" | "checkbox" | "date" | "time" | "datetime"
  options?: string[]
  required: boolean
}

interface TicketType {
  policy: string
  price: number
}

interface FormTabProps {
  userId: string
  eventId: string
  ticketTypes: TicketType[]
}

export default function FormTab({ userId, eventId, ticketTypes }: FormTabProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [ticketSettings, setTicketSettings] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")

  // Handle empty ticketTypes array (free event) by creating a default free ticket
  const effectiveTicketTypes = ticketTypes.length > 0 
    ? ticketTypes 
    : [{ policy: "Free Ticket", price: 0 }]

  useEffect(() => {
    fetchFormData()
  }, [userId, eventId])

  const fetchFormData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/survey?userId=${userId}&eventId=${eventId}`)
      const data = await response.json()

      if (data.success) {
        setQuestions(data.questions || [])
        setTicketSettings(data.ticketSettings || {})
      }
    } catch (error) {
      console.error("Error fetching form data:", error)
      setErrorMessage("Failed to load form data")
    } finally {
      setLoading(false)
    }
  }

  const handleAddQuestion = () => {
    const newQuestion: Question = {
      questionText: "",
      questionType: "short",
      required: false,
    }
    setQuestions([...questions, newQuestion])
  }

  const handleUpdateQuestion = (index: number, field: keyof Question, value: any) => {
    const newQuestions = [...questions]
    newQuestions[index] = {
      ...newQuestions[index],
      [field]: value,
    }

    // Clear options if switching away from radio/checkbox
    if (field === "questionType" && value !== "radio" && value !== "checkbox") {
      delete newQuestions[index].options
    }

    // Initialize options array if switching to radio/checkbox
    if (field === "questionType" && (value === "radio" || value === "checkbox")) {
      if (!newQuestions[index].options) {
        newQuestions[index].options = [""]
      }
    }

    setQuestions(newQuestions)
  }

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const handleAddOption = (questionIndex: number) => {
    const newQuestions = [...questions]
    if (!newQuestions[questionIndex].options) {
      newQuestions[questionIndex].options = []
    }
    newQuestions[questionIndex].options!.push("")
    setQuestions(newQuestions)
  }

  const handleUpdateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const newQuestions = [...questions]
    if (newQuestions[questionIndex].options) {
      newQuestions[questionIndex].options![optionIndex] = value
      setQuestions(newQuestions)
    }
  }

  const handleRemoveOption = (questionIndex: number, optionIndex: number) => {
    const newQuestions = [...questions]
    if (newQuestions[questionIndex].options) {
      newQuestions[questionIndex].options = newQuestions[questionIndex].options!.filter((_, i) => i !== optionIndex)
      setQuestions(newQuestions)
    }
  }

  const validateForm = () => {
    if (questions.length === 0) {
      setErrorMessage("Please add at least one question")
      return false
    }

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i]
      if (!question.questionText.trim()) {
        setErrorMessage(`Question ${i + 1} is missing text`)
        return false
      }

      if ((question.questionType === "radio" || question.questionType === "checkbox") && !question.options?.length) {
        setErrorMessage(`Question ${i + 1} needs at least one option`)
        return false
      }

      if (
        (question.questionType === "radio" || question.questionType === "checkbox") &&
        question.options?.some((opt) => !opt.trim())
      ) {
        setErrorMessage(`Question ${i + 1} has empty options`)
        return false
      }
    }

    setErrorMessage("")
    return true
  }

  const handleSaveForm = async () => {
    if (!validateForm()) {
      setSaveStatus("error")
      return
    }

    try {
      setSaving(true)
      setSaveStatus("idle")

      const response = await fetch("/api/survey", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          eventId,
          questions,
          ticketSettings,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSaveStatus("success")
        await fetchFormData()
        setTimeout(() => setSaveStatus("idle"), 3000)
      } else {
        setSaveStatus("error")
        setErrorMessage(data.error || "Failed to save form")
      }
    } catch (error) {
      console.error("Error saving form:", error)
      setSaveStatus("error")
      setErrorMessage("Failed to save form")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteForm = async () => {
    try {
      const response = await fetch(`/api/survey?userId=${userId}&eventId=${eventId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (data.success) {
        setQuestions([])
        setTicketSettings({})
        setSaveStatus("success")
        setTimeout(() => setSaveStatus("idle"), 3000)
      } else {
        setErrorMessage(data.error || "Failed to delete form")
      }
    } catch (error) {
      console.error("Error deleting form:", error)
      setErrorMessage("Failed to delete form")
    }
  }

  const getQuestionTypeIcon = (type: string) => {
    switch (type) {
      case "short":
        return <FileText className="w-4 h-4" />
      case "long":
        return <FileText className="w-4 h-4" />
      case "number":
        return <Hash className="w-4 h-4" />
      case "radio":
        return <Circle className="w-4 h-4" />
      case "checkbox":
        return <ListChecks className="w-4 h-4" />
      case "date":
        return <Calendar className="w-4 h-4" />
      case "time":
        return <Clock className="w-4 h-4" />
      case "datetime":
        return <Calendar className="w-4 h-4" />
      default:
        return <FileText className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-[#6b2fa5] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Event Form</h2>
          <p className="text-slate-600 mt-1">Create questions for your attendees to answer when booking tickets</p>
        </div>

        {questions.length > 0 && (
          <button
            onClick={handleSaveForm}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-[#6b2fa5] hover:bg-[#5a2589] text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Form
              </>
            )}
          </button>
        )}
      </div>

      {/* Free Event Indicator */}
      {ticketTypes.length === 0 && (
        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-emerald-100 rounded-full flex-shrink-0">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-emerald-900">Free Event</p>
              <p className="text-sm text-emerald-700">This form will apply to all attendees getting free tickets</p>
            </div>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {saveStatus === "success" && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg animate-in slide-in-from-top duration-300">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-emerald-800 font-medium">Form saved successfully!</p>
        </div>
      )}

      {(saveStatus === "error" || errorMessage) && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg animate-in slide-in-from-top duration-300">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-800 font-medium">{errorMessage || "Failed to save form"}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Questions Column */}
        <div className="lg:col-span-2 space-y-4">
          {questions.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl">
              <div className="flex items-center justify-center w-16 h-16 mx-auto bg-slate-200 rounded-full mb-4">
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No questions yet</h3>
              <p className="text-slate-600 mb-6">Start building your form by adding questions</p>
              <button
                onClick={handleAddQuestion}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#6b2fa5] hover:bg-[#5a2589] text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <Plus className="w-5 h-5" />
                Add First Question
              </button>
            </div>
          ) : (
            <>
              {questions.map((question, questionIndex) => (
                <div
                  key={questionIndex}
                  className="group bg-white border-2 border-slate-200 rounded-xl p-6 space-y-4 hover:border-[#6b2fa5]/30 hover:shadow-lg transition-all duration-200"
                >
                  {/* Question Header */}
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-slate-100 rounded-lg mt-1 cursor-move">
                      <GripVertical className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1 space-y-4">
                      {/* Question Text */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Question {questionIndex + 1}
                        </label>
                        <input
                          type="text"
                          value={question.questionText}
                          onChange={(e) => handleUpdateQuestion(questionIndex, "questionText", e.target.value)}
                          placeholder="Enter your question here..."
                          className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] transition-all duration-200"
                        />
                      </div>

                      {/* Question Type */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">Response Type</label>
                          <div className="relative">
                            <select
                              value={question.questionType}
                              onChange={(e) =>
                                handleUpdateQuestion(
                                  questionIndex,
                                  "questionType",
                                  e.target.value as Question["questionType"],
                                )
                              }
                              className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] transition-all duration-200 appearance-none bg-white cursor-pointer"
                            >
                              <option value="short">Short Answer</option>
                              <option value="long">Long Answer</option>
                              <option value="number">Number</option>
                              <option value="radio">Single Choice</option>
                              <option value="checkbox">Multiple Choice</option>
                              <option value="date">Date</option>
                              <option value="time">Time</option>
                              <option value="datetime">Date & Time</option>
                            </select>
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                              {getQuestionTypeIcon(question.questionType)}
                            </div>
                          </div>
                        </div>

                        {/* Required Toggle */}
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">Required</label>
                          <label className="relative inline-flex items-center cursor-pointer h-[42px]">
                            <input
                              type="checkbox"
                              checked={question.required}
                              onChange={(e) => handleUpdateQuestion(questionIndex, "required", e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#6b2fa5]/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[9px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#6b2fa5] shadow-inner"></div>
                            <span className="ml-3 text-sm font-medium text-slate-700">
                              {question.required ? "Yes" : "No"}
                            </span>
                          </label>
                        </div>
                      </div>

                      {/* Options for Radio/Checkbox */}
                      {(question.questionType === "radio" || question.questionType === "checkbox") && (
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-slate-700">Options</label>
                            <button
                              onClick={() => handleAddOption(questionIndex)}
                              className="flex items-center gap-1 text-sm text-[#6b2fa5] hover:text-[#5a2589] font-medium transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                              Add Option
                            </button>
                          </div>
                          <div className="space-y-2">
                            {question.options?.map((option, optionIndex) => (
                              <div key={optionIndex} className="flex items-center gap-2">
                                <div className="flex items-center justify-center w-6 h-6 bg-slate-100 rounded flex-shrink-0">
                                  {question.questionType === "radio" ? (
                                    <Circle className="w-3 h-3 text-slate-400" />
                                  ) : (
                                    <ListChecks className="w-3 h-3 text-slate-400" />
                                  )}
                                </div>
                                <input
                                  type="text"
                                  value={option}
                                  onChange={(e) => handleUpdateOption(questionIndex, optionIndex, e.target.value)}
                                  placeholder={`Option ${optionIndex + 1}`}
                                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]/50 focus:border-[#6b2fa5] transition-all duration-200"
                                />
                                {question.options && question.options.length > 1 && (
                                  <button
                                    onClick={() => handleRemoveOption(questionIndex, optionIndex)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Delete Question Button */}
                    <button
                      onClick={() => handleRemoveQuestion(questionIndex)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                      title="Delete question"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Add Question Button */}
              <button
                onClick={handleAddQuestion}
                className="w-full flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-slate-300 hover:border-[#6b2fa5] hover:bg-[#6b2fa5]/5 rounded-xl text-slate-600 hover:text-[#6b2fa5] font-semibold transition-all duration-200 group"
              >
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                Add Question
              </button>
            </>
          )}
        </div>

        {/* Settings Column */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <FormSettings
              ticketTypes={effectiveTicketTypes}
              ticketSettings={ticketSettings}
              onSettingsChange={setTicketSettings}
              onDeleteForm={handleDeleteForm}
              hasQuestions={questions.length > 0}
            />
          </div>
        </div>
      </div>
    </div>
  )
}