import {
  submitKYC,
  getUserKYC,
  updateKYCStatus,
  getAllKYC
} from "../service/kyc.service.js";
import { sendMessage } from "../service/message.service.js";
import { User } from "../model/user.model.js";

export const submitKYCController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Document image is required"
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
      message: err.message
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
      message: err.message
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

    // Send notification message to the user when KYC is approved/rejected
    try {
      const recipientId = kyc.user?._id || kyc.user || null;
      // determine sender: prefer x-user-id header, else pick any admin user as sender
      let senderId = req.headers['x-user-id'] || req.headers['user-id'];
      if (!senderId) {
        const adminUser = await User.findOne({ roles: { $in: ['admin', 'ADMIN'] } }).select('_id');
        if (adminUser) senderId = adminUser._id;
      }

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
      message: err.message
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
      message: err.message
    });
  }
};
