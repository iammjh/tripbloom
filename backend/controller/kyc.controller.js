import {
  submitKYC,
  getUserKYC,
  updateKYCStatus,
  getAllKYC
} from "../service/kyc.service.js";
import { sendMessage } from "../service/message.service.js";
import { User } from "../model/user.model.js";
import { logActivity } from "../service/activityLog.service.js";
import { hasExpectedSignature } from "../service/fileSignature.js";
import { unlink } from "node:fs/promises";

export const submitKYCController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Document image is required"
      });
    }
    // The file must actually be the type its name claims; otherwise it is deleted before anything is recorded.
    if (!(await hasExpectedSignature(req.file.path, req.file.originalname))) {
      await unlink(req.file.path).catch(() => {});
      return res.status(400).json({
        success: false,
        message: "The document must be a real JPEG, PNG or PDF file."
      });
    }

    const kyc = await submitKYC({
      user: req.user.id,
      documentType: req.body.documentType,
      documentNumber: req.body.documentNumber,
      documentImage: `uploads/kyc/${req.file.filename}` // NORMALIZED RELATIVE WEB PATH
    });

    res.status(201).json({
      success: true,
      message: "KYC submitted successfully",
      kyc
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'We could not complete this request. Please try again.'
    });
  }
};

export const getMyKYCController = async (req, res) => {
  try {
    const kyc = await getUserKYC(req.user.id);

    res.json({
      success: true,
      kyc
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'We could not complete this request. Please try again.'
    });
  }
};

export const verifyKYCController = async (req, res) => {
  try {
    const { status, remarks } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid KYC status"
      });
    }

    const kyc = await updateKYCStatus(req.params.id, status, remarks);

    await logActivity({
      adminId: req.user?.id,
      action: status === 'approved' ? 'KYC_APPROVED' : 'KYC_REJECTED',
      targetType: 'User',
      targetId: kyc.user?._id || kyc.user,
      description: `${status === 'approved' ? 'Approved' : 'Rejected'} KYC submission${remarks ? ': ' + remarks : ''}`,
      ipAddress: req.ip,
    });

    // Send notification message to the user when KYC is approved/rejected
    try {
      const recipientId = kyc.user?._id || kyc.user || null;
      const senderId = req.user.id;

      if (recipientId && senderId) {
        const content = status === 'approved'
          ? 'Your identity verification (KYC) has been approved. You can now book international tour packages.'
          : `Your KYC was rejected. ${remarks ? 'Reason: ' + remarks : ''}`;

        const result = await sendMessage({ senderId, recipientId, content, isBroadcast: false });
        if (result && result.error) {
          console.error('sendMessage returned error when notifying KYC update:', result.error);
        } else if (result && result.message) {
          console.log('KYC notification message saved:', result.message._id?.toString?.() || result.message._id);
        } else {
          console.log('KYC notification sendMessage result:', result);
        }
      }
    } catch (notifyErr) {
      console.error('Failed to send KYC notification message:', notifyErr.message || notifyErr);
    }

    res.json({
      success: true,
      message: `KYC ${status}`,
      kyc
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'We could not complete this request. Please try again.'
    });
  }
};

export const getAllKYCController = async (req, res) => {
  try {
    const { status } = req.query;
    const kycs = await getAllKYC({ status });

    res.json({
      success: true,
      kycs
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'We could not complete this request. Please try again.'
    });
  }
};
